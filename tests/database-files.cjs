const fs=require('node:fs');
const path=require('node:path');
const manifest=require('../docs/migration-manifest.json');
const sqlRoot=path.resolve(process.env.DEPTFLOW_SQL_DIR || path.join(__dirname,'..'));
const sqlFile=file=>path.join(sqlRoot,file);
const databaseSqlAvailable=manifest.files.every(file=>fs.existsSync(sqlFile(file.path)));
const databaseTestOptions={skip:databaseSqlAvailable ? false :
 'Database integration requires the separately supplied SQL package; set DEPTFLOW_SQL_DIR and run verify:release.'};
module.exports={sqlRoot,sqlFile,databaseSqlAvailable,databaseTestOptions};
