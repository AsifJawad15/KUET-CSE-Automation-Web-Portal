const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {hashSync}=require('bcryptjs');
const {install}=require('./routine-fixture.cjs');
test('administrator bootstrap rejects placeholders and provisions only private supplied credentials',async()=>{
 const engine=new PGlite();
 const db={query:(sql,params)=>params?engine.query(sql,params):engine.exec(sql).then(r=>r.at(-1))};
 try{
  await install(db);
  const template=fs.readFileSync('supabase_bootstrap_first_admin.sql','utf8');
  await assert.rejects(engine.exec(template),/privately generated bcrypt hash/);
  assert.equal((await engine.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n,0);
  const hash=hashSync('synthetic-regression-password-only',4);
  await engine.exec(template.replaceAll('__YOUR_ADMIN_EMAIL__','demo-admin@example.invalid').replaceAll('__YOUR_PRIVATE_BCRYPT_HASH__',hash));
  const profile=(await engine.query('SELECT * FROM profiles')).rows[0];
  assert.equal(profile.email,'demo-admin@example.invalid');
  assert.equal(profile.password_hash,hash);
  assert.equal((await engine.query('SELECT permissions FROM admins')).rows[0].permissions.all,true);
 }finally{await engine.close();}
});
