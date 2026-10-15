const fs = require('node:fs');
const path = require('node:path');
const {sqlFile,databaseTestOptions}=require('./database-files.cjs');
const { buildSolverInput } = require('../src/lib/routine-generator/buildSolverInput.ts');
const root=path.resolve(__dirname,'..');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

async function install(db) {
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role bypassrls; END IF;
  END $$;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
   SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
  for(const file of fs.readdirSync(sqlFile('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
    await db.query(fs.readFileSync(sqlFile(`supabase/migrations/${file}`),'utf8'));
  }
}

// Fixture adapter provides Supabase response shapes while all reads/RPC writes hit PostgreSQL.
function adapter(db) {
  return {
    rpc: async (name,args={}) => {
      try {
        const entries=Object.entries(args);
        const sql=`SELECT public.${name}(${entries.map(([key],i)=>`${key} => $${i+1}`).join(',')}) AS value`;
        const {rows}=await db.query(sql,entries.map(([,v])=>typeof v==='object'?JSON.stringify(v):v));
        return {data:rows[0].value,error:null};
      } catch(error) {return {data:null,error};}
    },
    from(table) {
      let projection='*'; const filters=[]; let ordering;
      const chain={
        select(value='*'){projection=value;return chain;},
        eq(key,value){filters.push(row=>read(row,key)===value);return chain;},
        in(key,value){filters.push(row=>value.includes(read(row,key)));return chain;},
        order(key){ordering=key;return chain;},
        async maybeSingle(){const r=await execute();return {...r,data:r.data?.[0]??null};},
        then(resolve,reject){return execute().then(resolve,reject);},
      };
      async function execute() {
        try {
          let rows=(await db.query(`SELECT * FROM public.${table}`)).rows;
          if(table==='routine_drafts' && projection.includes('routine_generation_jobs')) {
            for(const row of rows) row.routine_generation_jobs=(await db.query('SELECT * FROM routine_generation_jobs WHERE id=$1',[row.job_id])).rows[0];
          }
          if(table==='course_offerings') for(const row of rows) {
            row.courses=(await db.query('SELECT * FROM courses WHERE id=$1',[row.course_id])).rows[0];
            row.teachers=(await db.query('SELECT * FROM teachers WHERE user_id=$1',[row.teacher_user_id])).rows[0];
            row.teachers.profiles=(await db.query('SELECT is_active,role FROM profiles WHERE user_id=$1',[row.teacher_user_id])).rows[0];
          }
          if(table==='routine_slots') for(const row of rows) {
            row.course_offerings=(await db.query('SELECT * FROM course_offerings WHERE id=$1',[row.offering_id])).rows[0];
            const off=row.course_offerings;
            off.courses=(await db.query('SELECT * FROM courses WHERE id=$1',[off.course_id])).rows[0];
            off.teachers=(await db.query('SELECT * FROM teachers WHERE user_id=$1',[off.teacher_user_id])).rows[0];
            row.start_time=row.start_time.slice(0,8);row.end_time=row.end_time.slice(0,8);
          }
          rows=rows.filter(row=>filters.every(f=>f(row)));
          if(ordering) rows.sort((a,b)=>String(a[ordering]).localeCompare(String(b[ordering])));
          return {data:rows,error:null};
        }catch(error){return {data:null,error};}
      }
      return chain;
    }
  };
}
const read=(row,key)=>key.split('.').reduce((v,k)=>v?.[k],row);
async function seed(db) {
  await db.query(`INSERT INTO profiles(user_id,email,password_hash,role) VALUES
   ('${id(1)}','admin@example.invalid','not-a-login','ADMIN'),
   ('${id(2)}','teacher-a@example.invalid','not-a-login','TEACHER'),
   ('${id(3)}','teacher-b@example.invalid','not-a-login','TEACHER');
   INSERT INTO admins(user_id,full_name,permissions) VALUES('${id(1)}','Demo Administrator','{"all":true}');
   INSERT INTO teachers(user_id,full_name,phone) VALUES('${id(2)}','Demo A',''),('${id(3)}','Demo B','');
   INSERT INTO courses(id,code,title,credit,course_type) VALUES('${id(10)}','DEMO101','Synthetic Course',2,'Theory');
   INSERT INTO rooms(room_number,room_type,capacity) VALUES('R1','classroom',100),('R2','classroom',100);
   INSERT INTO course_offerings(id,course_id,teacher_user_id,term,session,section) VALUES
    ('${id(20)}','${id(10)}','${id(2)}','1-1','DEMO','A'),
    ('${id(21)}','${id(10)}','${id(3)}','1-1','DEMO','B');
   INSERT INTO course_schedule_requirements(session,year,term,section,course_id,required_theory_slots,needs_combined_section)
   VALUES('DEMO',1,1,'A','${id(10)}',2,true),('DEMO',1,1,'B','${id(10)}',2,true);`);
  const input=await buildSolverInput(adapter(db),'DEMO',1,1,'A',{
    includeExistingSelectedSlots:false,respectTeacherAvailability:true,respectRoomCapacity:true,allowSaturday:false,
    seed:42,maxNodes:1000,deterministic:true });
  await db.query('INSERT INTO routine_generation_jobs(id,session,year,term,section,status,requested_by,solver_input) VALUES($1,$2,1,1,$3,$4,$5,$6)',
    [id(30),'DEMO','A','completed',id(1),JSON.stringify(input)]);
  await db.query('INSERT INTO routine_drafts(id,job_id,draft_name) VALUES($1,$2,$3)',[id(40),id(30),'Demo Draft']);
  let n=50;
  for(const [i,activity] of input.activities.entries()) for(const t of activity.teachers) {
    await db.query(`INSERT INTO routine_draft_slots(id,draft_id,activity_id,course_id,course_offering_id,teacher_user_id,
     day_of_week,start_period,end_period,start_time,end_time,room_number,section,group_name) VALUES($1,$2,$3,$4,$5,$6,0,$7,$7,$8,$9,'R1',$10,$11)`,
     [id(n++),id(40),activity.id,activity.courseId,t.courseOfferingId,t.teacherUserId,i+1,
      i===0?'08:00:00':'08:50:00',i===0?'08:50:00':'09:40:00',t.section,activity.groupName]);
  }
  return {input,actor:{id:id(1),email:'admin@example.invalid',name:'Demo Administrator',role:'admin',sessionVersion:0},draftId:id(40)};
}
async function persisted(db,draftId) {
 return (await db.query('SELECT * FROM routine_draft_slots WHERE draft_id=$1 ORDER BY id',[draftId])).rows;
}
module.exports={install,adapter,seed,persisted,id,databaseTestOptions,sqlFile};
