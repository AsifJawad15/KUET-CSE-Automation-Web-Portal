const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateRoutineRecommendations, createSolverMetrics } = require('../src/lib/routine-generator/solver.ts');
const { validateDraft, validateSlot } = require('../src/lib/routine-generator/conflictValidator.ts');
const { timeToPeriod, normalizeCourseType, findRequirement } = require('../src/lib/routine-generator/buildSolverInput.ts');
const fixture = require('../examples/routine/input.json');
test('seed and node budget reproduce assignments and search counts', () => {
  const a = createSolverMetrics(42), b = createSolverMetrics(42);
  assert.deepEqual(generateRoutineRecommendations(fixture, 3, 25000, a), generateRoutineRecommendations(fixture, 3, 25000, b));
  a.elapsedMs = b.elapsedMs = 0; assert.deepEqual(a, b); assert.ok(a.nodes > 0);
});
test('all generated drafts have every activity and zero hard conflicts', () => {
  const drafts = generateRoutineRecommendations(fixture, 3); assert.equal(drafts.length, 3);
  for (const d of drafts) assert.equal(validateDraft(d.assignments, fixture).isValid, true);
});
test('reject missing and duplicate activities, invalid lab, room and teacher collisions', () => {
  const d = generateRoutineRecommendations(fixture, 1)[0];
  assert.equal(validateDraft(d.assignments.slice(1), fixture).isValid, false);
  assert.equal(validateDraft([...d.assignments, d.assignments[0]], fixture).isValid, false);
  const lab = d.assignments.find(a => a.activityId.includes('lab'));
  assert.equal(validateSlot({ ...lab, startPeriod: 2, endPeriod: 4 }, [], fixture).isValid, false);
  const a = { activityId: 'theory-a-0', dayOfWeek: 0, startPeriod: 2, endPeriod: 2, roomNumber: 'R1' };
  const b = { ...a, activityId: 'theory-b-0', roomNumber: 'R2' };
  assert.ok(validateSlot(a, [b], fixture).hardConflicts.some(c => c.type === 'teacher_overlap'));
  assert.ok(validateSlot(a, [{ ...b, roomNumber: 'R1' }], fixture).hardConflicts.some(c => c.type === 'room_overlap'));
});
test('capacity uses fixture enrolment and remains a warning', () => {
  const a = { activityId: 'theory-a-0', dayOfWeek: 0, startPeriod: 2, endPeriod: 2, roomNumber: 'R2' };
  assert.equal(validateSlot(a, [], fixture).isValid, true);
  assert.ok(validateSlot(a, [], fixture).softWarnings.some(c => c.type === 'room_capacity'));
});
test('infeasibility and exhaustion are explicit', () => {
  assert.deepEqual(generateRoutineRecommendations({ ...fixture, rooms: [] }, 1), []);
  const metrics = createSolverMetrics(42);
  assert.deepEqual(generateRoutineRecommendations({ ...fixture, options: { ...fixture.options, maxNodes: 1 } }, 1, 25000, metrics), []);
  assert.equal(metrics.termination, 'node_budget');
});
test('strict input types, time boundaries and section-specific requirements', () => {
  assert.equal(normalizeCourseType('Theory'), 'Theory');
  assert.throws(() => normalizeCourseType(''), /course_type/);
  assert.throws(() => timeToPeriod('09:17', '10:17'), /boundaries/);
  const requirements = [{ courseId: 'c', section: 'A', requiredTheorySlots: 2 }, { courseId: 'c', section: 'B', requiredTheorySlots: 4 }];
  assert.equal(findRequirement(requirements, 'c', 'B', 'b').requiredTheorySlots, 4);
});
