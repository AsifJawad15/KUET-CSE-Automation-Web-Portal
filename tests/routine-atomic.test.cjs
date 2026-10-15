const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {NextRequest}=require('next/server');
const {install,adapter,seed,persisted,id,databaseTestOptions}=require('./routine-fixture.cjs');
const {prepareDraftState}=require('../src/lib/routine-generator/draftState.ts');
const {verify}=require('../scripts/verify-routine.cjs');
process.env.AUTH_SESSION_SECRET='integration-fixture-only-secret';

test('real edit/publication routes preserve activity identity, scope, calendar and transaction state',databaseTestOptions,async t=>{
 const engine=new PGlite();
 const db={query:(sql,params)=>params ? engine.query(sql,params) : engine.exec(sql).then(results=>results.at(-1))};
 try {
  await install(db);
  const fixture=await seed(db);
  const client=adapter(db);
  require('../src/lib/supabaseAdmin.ts').getSupabaseAdmin=()=>client;
  const {createSessionToken}=require('../src/lib/serverAuth.ts');
  const edit=require('../src/app/api/routine-generator/update-draft-slot/route.ts').PATCH;
  const publish=require('../src/app/api/routine-generator/publish/route.ts').POST;
  const token=createSessionToken(fixture.actor);
  const request=(path,body,method)=>new NextRequest(`https://example.invalid/api/routine-generator/${path}`,{
   method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const move={draftId:fixture.draftId,slotIds:[id(50)],dayOfWeek:1,startPeriod:1,endPeriod:1,roomNumber:'R2'};
  await t.test('mixed-draft and multi-activity IDs fail without any write',async()=>{
   const before=await persisted(db,fixture.draftId);
   for(const slotIds of [[id(50),id(999)],[id(50),id(52)],[id(50),id(50)]]) {
    assert.equal((await edit(request('update-draft-slot',{...move,slotIds},'PATCH'))).status,400);
   }
   assert.deepEqual(await persisted(db,fixture.draftId),before);
  });
  await t.test('one combined activity moves all peers and leaves repeated component unchanged',async()=>{
   assert.equal((await edit(request('update-draft-slot',move,'PATCH'))).status,200);
   const slots=await persisted(db,fixture.draftId);
   assert.deepEqual(slots.map(s=>s.day_of_week),[1,1,0,0]);
   assert.deepEqual(slots.map(s=>s.room_number),['R2','R2','R1','R1']);
   const state=prepareDraftState(fixture.draftId,slots,fixture.input,fixture.input);
   verify(fixture.input,state.assignments);
   const summary=(await db.query('SELECT * FROM routine_drafts WHERE id=$1',[fixture.draftId])).rows[0];
   assert.equal(Number(summary.total_penalty),state.metrics.total_penalty);
   assert.equal(summary.hard_conflict_count,0);
  });
  await t.test('original Saturday exclusion remains enforced',async()=>{
   const before=await persisted(db,fixture.draftId);
   assert.equal((await edit(request('update-draft-slot',{...move,dayOfWeek:6},'PATCH'))).status,400);
   assert.deepEqual(await persisted(db,fixture.draftId),before);
  });
  await t.test('conflicting edit persists accurate labels and cannot be published',async()=>{
   assert.equal((await edit(request('update-draft-slot',{...move,dayOfWeek:0,startPeriod:2,endPeriod:2,roomNumber:'R1'},'PATCH'))).status,200);
   const slots=await persisted(db,fixture.draftId);
   assert.ok(slots.every(s=>s.conflict_status==='conflict'));
   assert.equal((await publish(request('publish',{draftId:fixture.draftId},'POST'))).status,409);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_versions')).rows[0].n,0);
   assert.equal((await edit(request('update-draft-slot',move,'PATCH'))).status,200);
  });
  await t.test('metrics failure rolls back peer updates',async()=>{
   const before=await persisted(db,fixture.draftId);
   await db.query('ALTER TABLE routine_drafts ADD CONSTRAINT fail_metrics CHECK(false) NOT VALID');
   assert.equal((await edit(request('update-draft-slot',{...move,dayOfWeek:2},'PATCH'))).status,500);
   assert.deepEqual(await persisted(db,fixture.draftId),before);
   await db.query('ALTER TABLE routine_drafts DROP CONSTRAINT fail_metrics');
  });
  await t.test('publication failure after deletion restores old timetable and audit/outbox',async()=>{
   await db.query(`INSERT INTO routine_slots(offering_id,room_number,day_of_week,start_time,end_time,section)
    VALUES('${id(20)}','R1',4,'08:00','08:50','A');
    ALTER TABLE routine_slots ADD CONSTRAINT fail_insert CHECK(false) NOT VALID`);
   const before=(await db.query('SELECT * FROM routine_slots')).rows;
   assert.equal((await publish(request('publish',{draftId:fixture.draftId},'POST'))).status,500);
   assert.deepEqual((await db.query('SELECT * FROM routine_slots')).rows,before);
   for(const table of ['routine_versions','notifications','notification_push_outbox'])
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
   await db.query('ALTER TABLE routine_slots DROP CONSTRAINT fail_insert');
  });
  await t.test('current teacher unavailability rejects a previously valid draft',async()=>{
   await db.query(`INSERT INTO teacher_availability(teacher_user_id,day_of_week,start_period,end_period,availability_type)
    VALUES('${id(2)}',1,1,1,'unavailable')`);
   assert.equal((await publish(request('publish',{draftId:fixture.draftId},'POST'))).status,409);
   await db.query('DELETE FROM teacher_availability');
  });
  await t.test('an assigned teacher becoming inactive or on leave blocks publication',async()=>{
   await db.query('UPDATE teachers SET is_on_leave=true WHERE user_id=$1',[id(2)]);
   assert.equal((await publish(request('publish',{draftId:fixture.draftId},'POST'))).status,409);
   await db.query('UPDATE teachers SET is_on_leave=false WHERE user_id=$1',[id(2)]);
   await db.query('UPDATE profiles SET is_active=false WHERE user_id=$1',[id(2)]);
   assert.equal((await publish(request('publish',{draftId:fixture.draftId},'POST'))).status,409);
   await db.query('UPDATE profiles SET is_active=true WHERE user_id=$1',[id(2)]);
  });
  await t.test('valid publication commits matching slots, selection, version and outbox',async()=>{
   const response=await publish(request('publish',{draftId:fixture.draftId},'POST'));
   assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_slots')).rows[0].n,4);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_versions')).rows[0].n,1);
   assert.equal((await db.query('SELECT is_selected FROM routine_drafts WHERE id=$1',[fixture.draftId])).rows[0].is_selected,true);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n,4);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM notification_push_outbox')).rows[0].n,4);
  });
  await t.test('editing a published draft clears its selected flag and preserves the immutable publication snapshot',async()=>{
   const master=(await db.query('SELECT * FROM routine_slots ORDER BY id')).rows;
   const audit=(await db.query('SELECT change_summary FROM routine_versions')).rows[0].change_summary;
   assert.equal(audit.slots.length,4);
   assert.equal((await edit(request('update-draft-slot',{...move,dayOfWeek:3},'PATCH'))).status,200);
   assert.equal((await db.query('SELECT is_selected FROM routine_drafts WHERE id=$1',[fixture.draftId])).rows[0].is_selected,false);
   assert.deepEqual((await db.query('SELECT * FROM routine_slots ORDER BY id')).rows,master);
   assert.deepEqual((await db.query('SELECT change_summary FROM routine_versions')).rows[0].change_summary,audit);
  });
 }finally{await engine.close();}
});
