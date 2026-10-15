const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {sqlFile,databaseTestOptions}=require('./database-files.cjs');
test('complete CMS installation exposes published content and denies anonymous mutations',databaseTestOptions,async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
  await db.exec(fs.readFileSync(sqlFile('database/cms_baseline.sql'),'utf8'));
  await db.exec(fs.readFileSync(sqlFile('database/cms_security_boundary.sql'),'utf8'));
  await db.exec(`INSERT INTO cms_hero_slides(image_path,title,is_active) VALUES('demo.svg','Public',true),('demo.svg','Hidden',false);
   INSERT INTO cms_news_events(title,published_at) VALUES('Published',now()),('Unpublished',NULL); SET ROLE anon;`);
  assert.deepEqual((await db.query('SELECT title FROM cms_hero_slides')).rows,[{title:'Public'}]);
  assert.deepEqual((await db.query('SELECT title FROM cms_news_events')).rows,[{title:'Published'}]);
  for(const sql of ["INSERT INTO cms_stats(label,value) VALUES('x','1')","UPDATE cms_hero_slides SET title='tampered'","DELETE FROM cms_news_events","SELECT * FROM cms_tv_devices"])
   await assert.rejects(db.query(sql),e=>e.code==='42501');
 }finally{await db.close();}
});
