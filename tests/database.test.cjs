const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('database migrations enforce grants, row ownership, session revocation and atomic attendance', {
  skip: !fs.existsSync('supabase/migrations/20260905006000_solver_run_evidence.sql') ||
    !fs.existsSync('supabase/migrations/20260101000000_baseline.sql')
    ? 'Local SQL migrations are distributed separately; restore them to run database verification.' : false,
}, async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    const protectedTables = ['profiles','students','notifications','device_push_tokens','geo_attendance_logs','password_recovery_tokens'];
    const rls = await db.query(`select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname = any($1::text[])`, [protectedTables]);
    assert.equal(rls.rows.length, protectedTables.length);
    for (const row of rls.rows) assert.equal(row.relrowsecurity, true, `${row.relname} must enable RLS`);
    const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
    await db.exec(`insert into profiles(user_id,email,password_hash,role) values ('${a}','a@example.invalid','hash','STUDENT'),('${b}','b@example.invalid','hash','STUDENT');
      insert into notifications(id,type,title,body,target_type,target_value) values
      ('10000000-0000-4000-8000-000000000001','announcement','Private A','Private','USER','${a}'),
      ('10000000-0000-4000-8000-000000000002','announcement','Private B','Private','USER','${b}');`);
    await db.exec('set role anon');
    for (const table of ['profiles','students','notifications','device_push_tokens','geo_attendance_logs','password_recovery_tokens']) {
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    }
    await assert.rejects(db.query(`select consume_password_recovery('x','y','z')`), /permission denied/);
    await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
    const inbox = await db.query('select title from notifications');
    assert.deepEqual(inbox.rows.map(r=>r.title), ['Private A']);
    await assert.rejects(db.query('select password_hash from profiles'), /permission denied/);
    await assert.rejects(db.query(`update profiles set password_hash='changed'`), /permission denied/);
    await assert.rejects(db.query(`insert into device_push_tokens(user_id,platform,token) values('${b}','android','stolen')`), /row-level security/);
    await db.exec(`insert into device_push_tokens(user_id,platform,token) values('${a}','android','own');`);
    assert.equal((await db.query('select * from device_push_tokens')).rows.length,1);
    await db.exec(`reset role; update profiles set password_hash='replacement' where user_id='${a}'`);
    assert.equal((await db.query(`select session_version from profiles where user_id='${a}'`)).rows[0].session_version,1);
    // An invalid attendance submission cannot manufacture enrolment or write any copy.
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','20000000-0000-4000-8000-000000000001',22.9,89.5,null)`), /not open/);
    assert.equal((await db.query('select count(*)::int as n from enrollments')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from geo_attendance_logs')).rows[0].n,0);
    const teacher='00000000-0000-4000-8000-000000000003', course='30000000-0000-4000-8000-000000000001';
    const offering='40000000-0000-4000-8000-000000000001', session='50000000-0000-4000-8000-000000000001';
    const room='20000000-0000-4000-8000-000000000001';
    await db.exec(`insert into profiles(user_id,email,password_hash,role) values('${teacher}','teacher@example.invalid','hash','TEACHER');
      insert into teachers(user_id,full_name,phone) values('${teacher}','Demo Teacher','');
      insert into students(user_id,roll_no,full_name,phone,term,session) values('${a}','DEMO1','Demo Student','','1-1','DEMO');
      insert into courses(id,code,title,credit) values('${course}','DEMO101','Demo',3);
      insert into course_offerings(id,course_id,teacher_user_id,term,session) values('${offering}','${course}','${teacher}','1-1','DEMO');
      insert into rooms(room_number,is_active,latitude,longitude) values('DEMO',true,22.9,89.5);
      insert into class_sessions(id,offering_id,room_number,starts_at,ends_at) values('${session}','${offering}','DEMO',now()-interval '1 minute',now()+interval '1 hour');
      insert into geo_attendance_rooms(id,offering_id,session_id,teacher_user_id,room_number,start_time,end_time)
        values('${room}','${offering}','${session}','${teacher}','DEMO',now()-interval '1 minute',now()+interval '1 hour');
      insert into geo_attendance_codes(room_id,code) values('${room}','123456');`);
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','${room}',22.9,89.5,'123456')`), /enrolment/);
    await db.exec(`insert into enrollments(offering_id,student_user_id) values('${offering}','${a}')`);
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','${room}',22.9,89.5,'wrong')`), /verification code/);
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','${room}',0,0,'123456')`), /radius/);
    // Force failure in the last write and prove preceding writes roll back too.
    await db.exec(`alter table attendance add constraint test_reject_write check(false) not valid`);
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','${room}',22.9,89.5,'123456')`), /test_reject_write/);
    assert.equal((await db.query('select count(*)::int as n from geo_attendance_logs')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from attendance_records')).rows[0].n,0);
    await db.exec('alter table attendance drop constraint test_reject_write');
    await db.query(`select submit_geo_attendance('${a}','${room}',22.9,89.5,'123456')`);
    await assert.rejects(db.query(`select submit_geo_attendance('${a}','${room}',22.9,89.5,'123456')`), /duplicate key/);
    for (const table of ['geo_attendance_logs','attendance_records','attendance']) assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n,1);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`);
    assert.equal((await db.query('select * from geo_attendance_codes')).rows.length,0);
    await assert.rejects(db.query(`select submit_geo_attendance('${b}','${room}',22.9,89.5,'123456')`), /permission denied/);
    // Mark-all is database-scoped and covers more than the first API page.
    await db.exec(`reset role; insert into notifications(type,title,body,target_type,target_value)
      select 'announcement','Bulk','Fixture','USER','${a}' from generate_series(1,510);
      set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`);
    assert.equal(Number((await db.query('select notification_unread_count() as n')).rows[0].n),511);
    await db.query('select mark_all_notifications_read()');
    assert.equal(Number((await db.query('select notification_unread_count() as n')).rows[0].n),0);
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as n from notification_reads where user_id='${b}'`)).rows[0].n,0);
    // Competing approvals cannot occupy the same room/time; adjacent intervals can.
    await db.exec(`insert into admin_direct_bookings(room_number,booking_date,day_of_week,start_time,end_time,booked_by_user_id)
      values('DEMO','2026-09-06',0,'09:00','10:00','${teacher}')`);
    await assert.rejects(db.query(`insert into admin_direct_bookings(room_number,booking_date,day_of_week,start_time,end_time,booked_by_user_id)
      values('DEMO','2026-09-06',0,'09:30','10:30','${teacher}')`),/already booked/);
    await db.exec(`insert into admin_direct_bookings(room_number,booking_date,day_of_week,start_time,end_time,booked_by_user_id)
      values('DEMO','2026-09-06',0,'10:00','11:00','${teacher}')`);
    await assert.rejects(db.query(`select record_teacher_attendance('${b}','${offering}','2026-09-07T03:00:00Z','DEMO','{"${a}":"PRESENT"}')`), /not assigned/);
    const before = Number((await db.query('select count(*) as n from class_sessions')).rows[0].n);
    await assert.rejects(db.query(`select record_teacher_attendance('${teacher}','${offering}','2026-09-07T03:00:00Z','DEMO','{"${a}":"PRESENT","${b}":"ABSENT"}')`), /active enrolment/);
    assert.equal(Number((await db.query('select count(*) as n from class_sessions')).rows[0].n),before);
    await db.query(`select record_teacher_attendance('${teacher}','${offering}','2026-09-07T03:00:00Z','DEMO','{"${a}":"PRESENT"}')`);
    await db.query(`select record_teacher_attendance('${teacher}','${offering}','2026-09-07T03:00:00Z','DEMO','{"${a}":"ABSENT"}')`);
    assert.equal(Number((await db.query('select count(*) as n from class_sessions')).rows[0].n),before+1);
    assert.equal(Number((await db.query('select count(*) as n from notifications n where not exists(select 1 from notification_push_outbox o where o.notification_id=n.id)')).rows[0].n),0);
  } finally { await db.close(); }
});
