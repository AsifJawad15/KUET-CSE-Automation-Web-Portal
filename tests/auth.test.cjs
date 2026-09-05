const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { NextRequest } = require('next/server');
process.env.AUTH_SESSION_SECRET = 'test-only-secret-never-a-deployment-default';
const admin = require('../src/lib/supabaseAdmin.ts');
let version = 0;
admin.getSupabaseAdmin = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_active: true, role: 'STUDENT', session_version: version } }) }) }) }) });
const auth = require('../src/lib/serverAuth.ts');
const student = { id: 'student-1', email: 'test@example.invalid', name: 'Test', role: 'student', sessionVersion: 0 };
test('unsigned, tampered, malformed, expired tokens fail closed', () => {
  const token = auth.createSessionToken(student);
  assert.equal(auth.verifySessionToken(token).id, student.id);
  for (const bad of ['', token + '.extra', 'changed.' + token.split('.')[1]]) assert.equal(auth.verifySessionToken(bad), null);
  const raw = Buffer.from(JSON.stringify({ ...student, iat: 1 })).toString('base64url');
  const signature = createHmac('sha256', process.env.AUTH_SESSION_SECRET).update(raw).digest('base64url');
  assert.equal(auth.verifySessionToken(`${raw}.${signature}`), null);
});
test('development requests do not get a synthetic administrator', async () => {
  const result = await auth.requireServerSession(new NextRequest('https://example.invalid/api/students'));
  assert.equal(result.response.status, 401);
});
test('wrong role and revoked session denied', async () => {
  const req = new NextRequest('https://example.invalid/api/students', { headers: { authorization: `Bearer ${auth.createSessionToken(student)}` } });
  assert.equal((await auth.requireServerSession(req, { adminLike: true })).response.status, 403);
  version = 1;
  assert.equal((await auth.requireServerSession(req)).response.status, 401);
  version = 0;
});
for (const path of ['teacher-portal/marks', 'teacher-portal/attendance', 'teacher-portal/geo-attendance',
  'teacher-portal/profile', 'teacher-portal/course-students', 'geo-room-locations', 'students/cr',
  'optional-course-assignments', 'upload/parse', 'routine-generator/generate']) {
  test(`${path} denies unauthenticated handlers before querying resources`, async () => {
    const route = require(`../src/app/api/${path}/route.ts`);
    for (const method of ['GET','POST','PATCH','DELETE']) if (route[method]) {
      const response = await route[method](new NextRequest(`https://example.invalid/api/${path}`, { method }));
      assert.equal(response.status, 401, method);
    }
  });
}
