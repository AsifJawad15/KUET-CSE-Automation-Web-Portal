const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDocxArchive, boundedFormData } = require('../src/lib/docxParser.ts');
const { adminRouteAllowed } = require('../src/lib/serverAdminPermissions.ts');
const { scoreDraft } = require('../src/lib/routine-generator/scoring.ts');
const fixture = require('../examples/routine/input.json');

test('custom room administrator cannot edit people, CMS, credentials or arbitrary data', () => {
  assert.equal(adminRouteAllowed('/api/rooms', 'POST', ['room-info']), true);
  for (const path of ['/api/students', '/api/staffs', '/api/auth/recovery', '/api/cms-data/cms_stats', '/api/data/profiles'])
    assert.equal(adminRouteAllowed(path, 'POST', ['room-info']), false);
});
test('upload bounds reject oversized bodies, malformed documents and extreme expansion', async () => {
  assert.throws(() => validateDocxArchive(Buffer.from('not a zip')), /Invalid DOCX/);
  const zip = Buffer.alloc(46); zip.writeUInt32LE(0x02014b50); zip.writeUInt32LE(1,20); zip.writeUInt32LE(1000000,24);
  assert.throws(() => validateDocxArchive(zip), /limits/);
  await assert.rejects(boundedFormData(new Request('https://example.invalid', { method:'POST', body:Buffer.alloc(2500001) })), /size limit/);
});
test('scoring does not mix sections and evaluates enabled Saturdays', () => {
  const input=structuredClone(fixture);
  const original=input.activities.find(a=>a.courseType==='Theory');
  input.activities=['A','B'].map((section,i)=>({...original,id:section,section,groupName:null,teachers:[{...original.teachers[0],teacherUserId:section,section}],courseId:section}));
  input.lockedSlots=[]; input.options.allowSaturday=true;
  const slots=[{activityId:'A',dayOfWeek:6,startPeriod:1,endPeriod:1,roomNumber:'R1'}, {activityId:'B',dayOfWeek:6,startPeriod:4,endPeriod:4,roomNumber:'R2'}];
  const result=scoreDraft(slots,input);
  assert.equal(result.components.student_gap,0);
  assert.ok(result.components.morning_theory>0);
  assert.equal(result.totalPenalty,Object.values(result.components).reduce((a,b)=>a+b,0));
});
