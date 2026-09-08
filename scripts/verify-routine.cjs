// Deliberately independent of the production validator and period helpers.
const assert = require('node:assert/strict');
exports.verify = (input, assignments) => {
  const byId = new Map(input.activities.map(a => [a.id, a]));
  assert.equal(assignments.length, byId.size);
  assert.equal(new Set(assignments.map(a => a.activityId)).size, byId.size);
  const overlaps = (a,b) => a.dayOfWeek === b.dayOfWeek && a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod;
  const sections = a => a.isCombined ? ['A','B'] : [a.section];
  for (const slot of assignments) {
    const a = byId.get(slot.activityId); assert.ok(a);
    assert.ok([0,1,2,3,4,...(input.options.allowSaturday ? [6] : [])].includes(slot.dayOfWeek));
    assert.equal(slot.endPeriod-slot.startPeriod+1, a.duration);
    assert.ok(slot.startPeriod>=1 && slot.endPeriod<=9);
    const room = input.rooms.find(r => r.room_number===slot.roomNumber); assert.ok(room?.is_active);
    assert.equal(room.room_type==='lab', a.courseType!=='Theory');
    if (a.courseType!=='Theory') assert.ok([1,4,7].includes(slot.startPeriod) && a.duration===3);
    for (const unavailable of input.teacherAvailabilities) if (unavailable.availabilityType==='unavailable' && a.teachers.some(t=>t.teacherUserId===unavailable.teacherUserId)) assert.ok(!overlaps(slot,unavailable));
    for (const locked of input.lockedSlots) if (overlaps(slot,locked)) {
      assert.notEqual(slot.roomNumber,locked.roomNumber);
      assert.ok(!a.teachers.some(t=>t.teacherUserId===locked.teacherUserId));
      if (locked.session===input.session && locked.term===`${input.year}-${input.term}` && sections(a).includes(locked.section)) {
        assert.ok(a.groupName && locked.groupName && a.groupName!==locked.groupName, 'Occupied cohort overlap');
      }
    }
    for (const other of assignments) if (other!==slot && overlaps(slot,other)) {
      const b=byId.get(other.activityId);
      assert.notEqual(slot.roomNumber,other.roomNumber);
      assert.ok(!a.teachers.some(t=>b.teachers.some(u=>u.teacherUserId===t.teacherUserId)));
      assert.ok(!sections(a).some(s=>sections(b).includes(s)) || (a.groupName && b.groupName && a.groupName!==b.groupName));
    }
  }
};
