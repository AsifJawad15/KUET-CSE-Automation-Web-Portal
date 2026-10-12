const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const {install,adapter,seed,persisted,id}=require('./routine-fixture.cjs');
const {commitDraftOperation}=require('../src/lib/routine-generator/atomicDraft.ts');
const {prepareDraftState}=require('../src/lib/routine-generator/draftState.ts');
const {verify}=require('../scripts/verify-routine.cjs');

test('real PostgreSQL rejects stale snapshots and serializes concurrent publications across cohorts',async t=>{
 const url=process.env.TEST_DATABASE_URL;
 assert.ok(url,'TEST_DATABASE_URL must point to an isolated local PostgreSQL instance.');
 const location=new URL(url);
 assert.ok(['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname),'Integration checks accept only a local isolated server.');
 const name=`deptflow_test_${randomBytes(8).toString('hex')}`;
 const admin=new Client({connectionString:url});await admin.connect();
 const connections=[];
 try{
  await admin.query(`CREATE DATABASE ${name}`);
  location.pathname=`/${name}`;
  const db=new Client({connectionString:location.toString()});await db.connect();connections.push(db);
  await install(db);const fixture=await seed(db);
  const other=new Client({connectionString:location.toString()});await other.connect();connections.push(other);
  await t.test('all client roles are denied the privileged commit RPC',async()=>{
   await other.query('SET ROLE authenticated');
   await assert.rejects(other.query('SELECT get_routine_revision()'),e=>e.code==='42501');
   await other.query('RESET ROLE');
  });
  await t.test('a stale validation result cannot commit after any relevant writer',async()=>{
   const revision=(await db.query('SELECT get_routine_revision() AS revision')).rows[0].revision;
   const state=prepareDraftState(fixture.draftId,await persisted(db,fixture.draftId),fixture.input,fixture.input);
   await other.query("UPDATE rooms SET capacity=capacity+1 WHERE room_number='R1'");
   await assert.rejects(db.query('SELECT commit_routine_draft($1,$2,0,$3,$4,$5,false,true)',
    [revision,fixture.actor.id,fixture.draftId,JSON.stringify(state.rows),JSON.stringify(state.metrics)]),e=>e.code==='40001');
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_versions')).rows[0].n,0);
  });
  await t.test('a changed account session is rejected inside the protected operation',async()=>{
   const revision=(await db.query('SELECT get_routine_revision() AS revision')).rows[0].revision;
   const state=prepareDraftState(fixture.draftId,await persisted(db,fixture.draftId),fixture.input,fixture.input);
   await other.query('UPDATE profiles SET session_version=1 WHERE user_id=$1',[fixture.actor.id]);
   await assert.rejects(db.query('SELECT commit_routine_draft($1,$2,0,$3,$4,$5,false,true)',
    [revision,fixture.actor.id,fixture.draftId,JSON.stringify(state.rows),JSON.stringify(state.metrics)]),e=>e.code==='42501');
   await other.query('UPDATE profiles SET session_version=0 WHERE user_id=$1',[fixture.actor.id]);
  });
  await t.test('a role change immediately revokes assignment-derived database access',async()=>{
   await other.query(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id(2)}',false)`);
   assert.equal((await other.query('SELECT deptflow_private.teaches($1) AS allowed',[id(20)])).rows[0].allowed,true);
   await db.query("UPDATE profiles SET role='ADMIN' WHERE user_id=$1",[id(2)]);
   assert.equal((await other.query('SELECT deptflow_private.teaches($1) AS allowed',[id(20)])).rows[0].allowed,false);
   await db.query("UPDATE profiles SET role='TEACHER' WHERE user_id=$1",[id(2)]);
   await other.query('RESET ROLE');
  });
  await t.test('competing cohorts sharing a teacher/room cannot both publish',async()=>{
   await db.query(`INSERT INTO course_offerings(id,course_id,teacher_user_id,term,session,section)
    VALUES('${id(120)}','${id(10)}','${id(2)}','2-1','DEMO','A');
    INSERT INTO routine_generation_jobs(id,session,year,term,section,status,requested_by,solver_input)
    SELECT '${id(130)}',session,2,term,section,status,requested_by,solver_input FROM routine_generation_jobs WHERE id='${id(30)}';
    INSERT INTO routine_drafts(id,job_id,draft_name) VALUES('${id(140)}','${id(130)}','Competing Cohort');`);
   const input=structuredClone(fixture.input);input.year=2;input.activities=input.activities.map(a=>({...a,
    id:a.id.replace(id(20),id(120)),section:'A',isCombined:false,teachers:[{...a.teachers[0],courseOfferingId:id(120)}]}));
   await db.query('UPDATE routine_generation_jobs SET solver_input=$1 WHERE id=$2',[JSON.stringify(input),id(130)]);
   for(const [i,a] of input.activities.entries()) await db.query(`INSERT INTO routine_draft_slots(id,draft_id,activity_id,
    course_id,course_offering_id,teacher_user_id,day_of_week,start_period,end_period,start_time,end_time,room_number,section)
    VALUES($1,$2,$3,$4,$5,$6,0,$7,$7,$8,$9,'R1','A')`,[id(150+i),id(140),a.id,id(10),id(120),id(2),i+1,
     i===0?'08:00':'08:50',i===0?'08:50':'09:40']);
   const results=await Promise.allSettled([
    commitDraftOperation(adapter(db),fixture.actor,fixture.draftId,{publish:true}),
    commitDraftOperation(adapter(other),fixture.actor,id(140),{publish:true}),
   ]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(results));
   const rejected=results.find(r=>r.status==='rejected').reason;
   assert.ok(rejected.code==='40001' || /Cannot publish/.test(rejected.message),String(rejected));
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_versions')).rows[0].n,1);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_drafts WHERE is_selected')).rows[0].n,1);
   const winner=(await db.query('SELECT source_draft_id FROM routine_versions')).rows[0].source_draft_id;
   const winnerInput=winner===fixture.draftId?fixture.input:input;
   verify(winnerInput,prepareDraftState(winner,await persisted(db,winner),winnerInput,winnerInput).assignments);
  });
 }finally{
  await Promise.all(connections.map(c=>c.end()));
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);await admin.end();
 }
});
