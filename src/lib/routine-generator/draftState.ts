import { validateDraft } from './conflictValidator';
import { scoreDraft } from './scoring';
import { periodRangeToTime } from './periods';
import type { ScheduleAssignment, SolverInput } from './types';

export interface DraftSlot {
  id: string; draft_id: string; activity_id: string | null;
  course_offering_id: string; course_id: string; teacher_user_id: string;
  section: string | null; group_name: string | null;
  day_of_week: number; start_period: number; end_period: number; room_number: string;
}
export interface DraftMove {
  slotIds: string[]; dayOfWeek: number; startPeriod: number; endPeriod: number; roomNumber: string;
}

function activitySignature(input: SolverInput) {
  return input.activities.map(a => JSON.stringify({ id: a.id, courseId: a.courseId,
    courseType: a.courseType, duration: a.duration, section: a.section, groupName: a.groupName,
    isCombined: a.isCombined, teachers: a.teachers.map(t => ({ id: t.courseOfferingId,
      teacher: t.teacherUserId, section: t.section })).sort((a,b) => a.id.localeCompare(b.id)),
  })).sort();
}

export function prepareDraftState(draftId: string, slots: DraftSlot[], saved: SolverInput,
  current: SolverInput, move?: DraftMove) {
  if (!saved?.activities?.length || !saved.options || slots.length === 0 ||
      slots.some(s => s.draft_id !== draftId || !s.activity_id)) {
    throw new Error('This draft requires regeneration with stable activity IDs.');
  }
  if (JSON.stringify(activitySignature(saved)) !== JSON.stringify(activitySignature(current))) {
    throw new Error('Course requirements or assignments changed; regenerate this draft.');
  }
  let editedActivity: string | undefined;
  if (move) {
    const ids = new Set(move.slotIds);
    if (!ids.size || ids.size !== move.slotIds.length || move.slotIds.some(id => typeof id !== 'string' || !id)) {
      throw new Error('slotIds must contain unique non-empty strings.');
    }
    const selected = slots.filter(s => ids.has(s.id));
    if (selected.length !== ids.size) throw new Error('Every slot ID must belong to the selected draft.');
    const activities = new Set(selected.map(s => s.activity_id));
    if (activities.size !== 1) throw new Error('The edit must identify one complete activity.');
    editedActivity = selected[0].activity_id!;
  }
  const assignments: ScheduleAssignment[] = [];
  const seen = new Set<string>();
  for (const activity of saved.activities) {
    const peers = slots.filter(s => s.activity_id === activity.id);
    if (peers.length !== activity.teachers.length || peers.some(s => !activity.teachers.some(t =>
      t.courseOfferingId === s.course_offering_id && t.teacherUserId === s.teacher_user_id &&
      (t.section || saved.section) === s.section)) ||
      new Set(peers.map(s => s.course_offering_id)).size !== peers.length ||
      peers.some(s => s.course_id !== activity.courseId || s.group_name !== activity.groupName)) {
      throw new Error('Draft activity peers do not match the saved generation input.');
    }
    const first = peers[0];
    if (peers.some(s => s.day_of_week !== first.day_of_week || s.start_period !== first.start_period ||
      s.end_period !== first.end_period || s.room_number !== first.room_number)) {
      throw new Error('Combined activity peers are inconsistent; regenerate this draft.');
    }
    peers.forEach(s => seen.add(s.id));
    assignments.push({ activityId: activity.id,
      dayOfWeek: activity.id === editedActivity ? move!.dayOfWeek : first.day_of_week,
      startPeriod: activity.id === editedActivity ? move!.startPeriod : first.start_period,
      endPeriod: activity.id === editedActivity ? move!.endPeriod : first.end_period,
      roomNumber: activity.id === editedActivity ? move!.roomNumber : first.room_number });
  }
  if (seen.size !== slots.length) throw new Error('Draft contains unknown or duplicated activity rows.');
  const validation = validateDraft(assignments, current);
  const scoring = scoreDraft(assignments, current);
  const warnings = [...validation.softWarnings, ...scoring.warnings];
  const rows = slots.map(slot => {
    const assignment = assignments.find(a => a.activityId === slot.activity_id)!;
    const range = periodRangeToTime(assignment.startPeriod, assignment.endPeriod);
    if (!range) throw new Error('Invalid period boundaries.');
    const hard = validation.hardConflicts.filter(c => !c.activityId || c.activityId === assignment.activityId);
    const soft = warnings.filter(c => c.activityId === assignment.activityId);
    return { id: slot.id, activity_id: slot.activity_id, day_of_week: assignment.dayOfWeek,
      start_period: assignment.startPeriod, end_period: assignment.endPeriod, room_number: assignment.roomNumber,
      start_time: `${range.start}:00`, end_time: `${range.end}:00`,
      conflict_status: hard.length ? 'conflict' : soft.length ? 'warning' : 'valid',
      conflict_reasons: [...hard, ...soft].map(c => c.reason) };
  });
  return { assignments, rows, validation, metrics: { score: scoring.score,
    total_penalty: scoring.totalPenalty, penalty_components: scoring.components, validation_input: current,
    hard_conflict_count: validation.hardConflicts.length, soft_warning_count: warnings.length,
    summary: { reason: validation.isValid ? 'Draft revalidated against current resources.' : 'Draft contains conflicts.',
      advantages: [], disadvantages: validation.hardConflicts.map(c => c.reason) } } };
}
