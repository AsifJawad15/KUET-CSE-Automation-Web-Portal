// Run privately on your own machine. Do not include the output in public logs.
const {randomBytes}=require('node:crypto');
const {hashSync}=require('bcryptjs');
const password=randomBytes(24).toString('base64url');
console.log('Private administrator password:',password);
console.log('Bcrypt hash for the bootstrap SQL:',hashSync(password,12));
