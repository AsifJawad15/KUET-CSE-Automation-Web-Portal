const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=require('../docs/migration-manifest.json');
const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()
 .map(f=>`supabase/migrations/${f}`).concat(['database/cms_baseline.sql','database/cms_security_boundary.sql']);
manifest.files=files.map(file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')}));
fs.writeFileSync(path.join(root,'docs/migration-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Updated checksums for the reviewed reconstructed release. Historical September manifest preserved.');
