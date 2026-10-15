const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {install,seed,id,databaseTestOptions}=require('./routine-fixture.cjs');
test('legacy manual combined classes remain valid while duplicates and partial-overlap conflicts are rejected',databaseTestOptions,async()=>{
 const engine=new PGlite();
 const db={query:(sql,params)=>params?engine.query(sql,params):engine.exec(sql).then(r=>r.at(-1))};
 try{
  await install(db);await seed(db);
  const insert=(off,section,start,end)=>db.query(`INSERT INTO routine_slots(offering_id,room_number,day_of_week,start_time,end_time,section)
   VALUES($1,'R1',0,$2,$3,$4)`,[off,start,end,section]);
  await insert(id(20),'A','08:00','08:50');
  await insert(id(21),'B','08:00','08:50');
  await assert.rejects(insert(id(20),'A','08:00','08:50'),e=>e.code==='23P01');
  await assert.rejects(insert(id(21),'B','08:30','09:20'),e=>e.code==='23P01');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM routine_slots')).rows[0].n,2);
 }finally{await engine.close();}
});
