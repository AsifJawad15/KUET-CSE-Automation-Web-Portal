const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const admin=require('../src/lib/supabaseAdmin.ts');
admin.isSupabaseAdminConfigured=()=>true;
const slot=(id,term,session,code)=>({id,section:'A',day_of_week:0,start_time:'08:00',
 end_time:'08:50',course_offerings:{term,session,courses:{code}}});
const rows=[slot('selected','3-2','2023-2024','CSE 3209'),
 slot('other-session','3-2','2025-2026','CSE 3209'),
 slot('wrong-term','3-1','2023-2024','CSE 3218'),
 slot('nonstandard-code','3-2','2023-2024','ELECTIVE')];
admin.getSupabaseAdmin=()=>({from:()=>{
 const query={select:()=>query,order:()=>query,eq:()=>query,
  then:resolve=>Promise.resolve(resolve({data:rows,error:null}))};
 return query;
}});
const resolver={resolveTvScheduleRange:async()=>{throw new Error('Unexpected dated request');}};
require.cache[require.resolve('../src/services/tvScheduleResolver.ts')]={exports:resolver};
const {GET}=require('../src/app/api/routine-slots/route.ts');
test('weekly timetable respects offering term and selected session rather than course digits',async()=>{
 const response=await GET(new NextRequest('https://example.invalid/api/routine-slots?term=3-2&session=2023-2024&section=A'));
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).map(s=>s.id),['selected','nonstandard-code']);
});
test('unfiltered weekly consumers retain all sessions',async()=>{
 const response=await GET(new NextRequest('https://example.invalid/api/routine-slots'));
 assert.equal((await response.json()).length,4);
});
test('dated timetable respects offering term and session as well',async()=>{
 resolver.resolveTvScheduleRange=async()=>({days:{'2026-10-13':rows.map(s=>({
  id:s.id,section:s.section,source:'routine',term:s.course_offerings.term,
  session:s.course_offerings.session,courseCode:s.course_offerings.courses.code,
  roomNumber:'R1',startTime:'08:00',endTime:'08:50',date:'2026-10-13'
 }))}});
 const response=await GET(new NextRequest('https://example.invalid/api/routine-slots?date=2026-10-13&term=3-2&session=2023-2024'));
 assert.deepEqual((await response.json()).map(s=>s.id),['selected','nonstandard-code']);
});
test('timetable service exposes API failures instead of reporting an empty timetable',async()=>{
 const client=require('../src/lib/httpClient.ts').apiClient;
 const original=client.get;
 client.get=async()=>({success:false,error:'Database unavailable'});
 try {
  await assert.rejects(require('../src/services/routineService.ts').getRoutineSlots(),/Database unavailable/);
 } finally {client.get=original;}
});
