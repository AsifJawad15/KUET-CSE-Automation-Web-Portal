const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {install,seed,id}=require('./routine-fixture.cjs');
test('geo-attendance rejects foreign sessions, other lab groups and invalid room coordinates without partial records',async()=>{
 const engine=new PGlite();
 const db={query:(sql,params)=>params?engine.query(sql,params):engine.exec(sql).then(r=>r.at(-1))};
 try{
  await install(db);await seed(db);
  await db.query(`INSERT INTO profiles(user_id,email,password_hash,role) VALUES('${id(5)}','student@example.invalid','not-a-login','STUDENT');
   INSERT INTO students(user_id,roll_no,full_name,phone,term,session,section) VALUES('${id(5)}','DEMO031','Demo Student','','1-1','DEMO','A');
   INSERT INTO enrollments(offering_id,student_user_id) VALUES('${id(20)}','${id(5)}');
   UPDATE rooms SET latitude=22.9,longitude=89.5;
   INSERT INTO class_sessions(id,offering_id,room_number,starts_at,ends_at) VALUES
    ('${id(70)}','${id(21)}','R1',now()-interval '1 minute',now()+interval '1 hour'),
    ('${id(71)}','${id(20)}','R1',now()-interval '1 minute',now()+interval '1 hour');
   INSERT INTO geo_attendance_rooms(id,offering_id,session_id,teacher_user_id,room_number,start_time,end_time)
    VALUES('${id(80)}','${id(20)}','${id(70)}','${id(2)}','R1',now()-interval '1 minute',now()+interval '1 hour');`);
  const submit=()=>db.query('SELECT submit_geo_attendance($1,$2,22.9,89.5,NULL)',[id(5),id(80)]);
  await assert.rejects(submit(),/Class session does not match/);
  await db.query("UPDATE geo_attendance_rooms SET session_id=$1,section='A1' WHERE id=$2",[id(71),id(80)]);
  await assert.rejects(submit(),/lab group does not match/);
  await db.query("UPDATE geo_attendance_rooms SET section='A2' WHERE id=$1",[id(80)]);
  await db.query("UPDATE rooms SET latitude=190 WHERE room_number='R1'");
  await assert.rejects(submit(),/coordinates required/);
  for(const table of ['geo_attendance_logs','attendance_records','attendance'])
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
  await db.query("UPDATE rooms SET latitude=22.9 WHERE room_number='R1'");
  await submit();
  for(const table of ['geo_attendance_logs','attendance_records','attendance'])
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
  await db.query(`UPDATE geo_attendance_rooms SET is_active=false WHERE id='${id(80)}';
   INSERT INTO class_sessions(id,offering_id,room_number,starts_at,ends_at)
    VALUES('${id(72)}','${id(20)}','R1',now(),now()+interval '1 hour');
   INSERT INTO geo_attendance_rooms(id,offering_id,session_id,teacher_user_id,room_number,start_time,end_time,section)
    VALUES('${id(81)}','${id(20)}','${id(72)}','${id(2)}','R1',now()-interval '1 minute',now()+interval '1 hour','A2');`);
  await db.query('SELECT submit_geo_attendance($1,$2,22.9,89.5,NULL)',[id(5),id(81)]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance_records')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM geo_attendance_logs')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance')).rows[0].n,1);
 }finally{await engine.close();}
});
