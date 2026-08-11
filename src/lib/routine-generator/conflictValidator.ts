import {
  ScheduleAssignment,
  SolverInput,
  ValidationResult,
  HardConflict,
  SoftWarning,
  ScheduleActivity,
  LockedSlot,
  TeacherAvailability,
} from './types';
import { periodsOverlap, dayNumberToName } from './periods';

/**
 * Validate a candidate slot assignment against the current context of assignments.
 */
export function validateSlot(
  candidate: ScheduleAssignment,
  existingAssignments: ScheduleAssignment[],
  context: SolverInput
): ValidationResult {
  const hardConflicts: HardConflict[] = [];
  const softWarnings: SoftWarning[] = [];

  const activity = context.activities.find((a) => a.id === candidate.activityId);
  if (!activity) {
    return { isValid: false, hardConflicts: [{ type: 'unknown_activity', reason: 'Activity not found in context' }], softWarnings };
  }

  const {
    respectTeacherAvailability = true,
    respectRoomCapacity = true,
  } = context.options || {};

  // 1. Break/Lunch & Block Validity Check
  if (activity.courseType === 'Lab' || activity.courseType === 'Sessional') {
    const start = candidate.startPeriod;
    const isValidBlock = (start === 1 || start === 4 || start === 7) && candidate.endPeriod - start + 1 === 3;
    if (!isValidBlock) {
      hardConflicts.push({
        type: 'break_lunch_violation',
        reason: `Lab course ${activity.courseCode} must be scheduled in blocks 1-3, 4-6, or 7-9. Got periods ${candidate.startPeriod}-${candidate.endPeriod}.`,
        activityId: candidate.activityId,
      });
    }
  }

  // 2. Room Type Policy Check
  const room = context.rooms.find((r) => r.room_number === candidate.roomNumber);
  if (room) {
    if (!room.is_active) {
      hardConflicts.push({
        type: 'room_inactive',
        reason: `Room ${candidate.roomNumber} is inactive.`,
        activityId: candidate.activityId,
      });
    }

    const isLabCourse = activity.courseType === 'Lab' || activity.courseType === 'Sessional';
    const isLabRoom = room.room_type === 'lab';

    if (isLabCourse && !isLabRoom) {
      hardConflicts.push({
        type: 'room_type_match',
        reason: `Lab course ${activity.courseCode} requires a lab room, but Room ${candidate.roomNumber} is a ${room.room_type || 'theory'} room.`,
        activityId: candidate.activityId,
      });
    } else if (!isLabCourse && isLabRoom) {
      hardConflicts.push({
        type: 'room_type_match',
        reason: `Theory course ${activity.courseCode} cannot be scheduled in lab Room ${candidate.roomNumber}.`,
        activityId: candidate.activityId,
      });
    }

    // 3. Room Capacity check (if enabled)
    if (respectRoomCapacity && room.capacity) {
      const estimatedStudents = activity.groupName ? 35 : 70; // Lab groups are roughly 35, full sections 70
      if (room.capacity < estimatedStudents) {
        softWarnings.push({
          type: 'room_capacity',
          reason: `Room ${candidate.roomNumber} capacity (${room.capacity}) is less than estimated student count (${estimatedStudents}) for ${activity.courseCode}.`,
          penalty: 5,
          activityId: candidate.activityId,
        });
      }
    }
  } else {
    hardConflicts.push({
      type: 'room_not_found',
      reason: `Room ${candidate.roomNumber} does not exist.`,
      activityId: candidate.activityId,
    });
  }

  // 4. Teacher Availability (if enabled)
  if (respectTeacherAvailability) {
    for (const t of activity.teachers) {
      const unavailabilities = context.teacherAvailabilities.filter(
        (a) =>
          a.teacherUserId === t.teacherUserId &&
          a.dayOfWeek === candidate.dayOfWeek &&
          a.availabilityType === 'unavailable' &&
          periodsOverlap(candidate.startPeriod, candidate.endPeriod, a.startPeriod, a.endPeriod)
      );

      if (unavailabilities.length > 0) {
        hardConflicts.push({
          type: 'teacher_unavailability',
          reason: `Dr./Prof. ${t.teacherName} is unavailable on ${dayNumberToName(candidate.dayOfWeek)} periods ${candidate.startPeriod}-${candidate.endPeriod}.`,
          activityId: candidate.activityId,
        });
      }

      const notPreferred = context.teacherAvailabilities.filter(
        (a) =>
          a.teacherUserId === t.teacherUserId &&
          a.dayOfWeek === candidate.dayOfWeek &&
          a.availabilityType === 'not_preferred' &&
          periodsOverlap(candidate.startPeriod, candidate.endPeriod, a.startPeriod, a.endPeriod)
      );

      if (notPreferred.length > 0) {
        softWarnings.push({
          type: 'teacher_preference',
          reason: `Dr./Prof. ${t.teacherName} prefers not to teach on ${dayNumberToName(candidate.dayOfWeek)} periods ${candidate.startPeriod}-${candidate.endPeriod}.`,
          penalty: 10,
          activityId: candidate.activityId,
        });
      }
    }
  }

  // 5. Compare against existing assignments in the current draft
  for (const existing of existingAssignments) {
    if (existing.activityId === candidate.activityId) continue;

    const existAct = context.activities.find((a) => a.id === existing.activityId);
    if (!existAct) continue;

    const timeOverlap =
      candidate.dayOfWeek === existing.dayOfWeek &&
      periodsOverlap(candidate.startPeriod, candidate.endPeriod, existing.startPeriod, existing.endPeriod);

    if (!timeOverlap) continue;

    // Check Combined exemption:
    // Concurrently taught combined classes taught together in the same room/time are allowed
    const isCombinedMatch =
      activity.courseId === existAct.courseId &&
      candidate.roomNumber === existing.roomNumber &&
      activity.isCombined &&
      existAct.isCombined;

    if (isCombinedMatch) continue;

    // A. Teacher conflict (check intersection of teachers)
    for (const t of activity.teachers) {
      const matchTeacher = existAct.teachers.find((et) => et.teacherUserId === t.teacherUserId);
      if (matchTeacher) {
        hardConflicts.push({
          type: 'teacher_overlap',
          reason: `Dr./Prof. ${t.teacherName} is already occupied with ${existAct.courseCode} on ${dayNumberToName(existing.dayOfWeek)} period ${existing.startPeriod}.`,
          activityId: candidate.activityId,
        });
      }
    }

    // B. Room conflict
    if (candidate.roomNumber === existing.roomNumber) {
      hardConflicts.push({
        type: 'room_overlap',
        reason: `Room ${candidate.roomNumber} is already occupied by ${existAct.courseCode} on ${dayNumberToName(existing.dayOfWeek)} period ${existing.startPeriod}.`,
        activityId: candidate.activityId,
      });
    }

    // C. Section and Group conflict
    const getTargetSections = (act: ScheduleActivity): string[] => {
      if (act.isCombined) return ['A', 'B'];
      return act.section ? [act.section] : [];
    };

    const sectionsA = getTargetSections(activity);
    const sectionsB = getTargetSections(existAct);
    const hasSectionOverlap = sectionsA.some((s) => sectionsB.includes(s));

    if (hasSectionOverlap) {
      const groupConflict =
        activity.groupName === null ||
        existAct.groupName === null ||
        activity.groupName === existAct.groupName;

      if (groupConflict) {
        const overlapSection = sectionsA.find((s) => sectionsB.includes(s)) || 'N/A';
        hardConflicts.push({
          type: 'section_overlap',
          reason: `Section ${overlapSection} (${activity.groupName || 'Whole'}) already has ${existAct.courseCode} (${existAct.groupName || 'Whole'}) scheduled on ${dayNumberToName(existing.dayOfWeek)} period ${existing.startPeriod}.`,
          activityId: candidate.activityId,
        });
      }
    }
  }

  // 6. Compare against locked slots (other batches/sections routine slots)
  for (const locked of context.lockedSlots) {
    const timeOverlap =
      candidate.dayOfWeek === locked.dayOfWeek &&
      periodsOverlap(candidate.startPeriod, candidate.endPeriod, locked.startPeriod, locked.endPeriod);

    if (!timeOverlap) continue;

    // A. Teacher conflict
    for (const t of activity.teachers) {
      if (t.teacherUserId === locked.teacherUserId) {
        hardConflicts.push({
          type: 'teacher_overlap',
          reason: `Dr./Prof. ${t.teacherName} is already occupied by ${locked.courseCode} (locked slot for Year/Term: ${locked.term}, Section: ${locked.section || 'N/A'}) on ${dayNumberToName(locked.dayOfWeek)} period ${locked.startPeriod}.`,
          activityId: candidate.activityId,
        });
      }
    }

    // B. Room conflict
    if (candidate.roomNumber === locked.roomNumber) {
      hardConflicts.push({
        type: 'room_overlap',
        reason: `Room ${candidate.roomNumber} is already occupied by ${locked.courseCode} (locked slot for Year/Term: ${locked.term}, Section: ${locked.section || 'N/A'}) on ${dayNumberToName(locked.dayOfWeek)} period ${locked.startPeriod}.`,
        activityId: candidate.activityId,
      });
    }

    // C. Section conflict
    const getTargetSections = (act: ScheduleActivity): string[] => {
      if (act.isCombined) return ['A', 'B'];
      return act.section ? [act.section] : [];
    };

    const isSameTargetSection =
      locked.term === `${context.year}-${context.term}` &&
      locked.section !== null &&
      getTargetSections(activity).includes(locked.section);

    if (isSameTargetSection) {
      const groupConflict =
        activity.groupName === null ||
        locked.groupName === null ||
        activity.groupName === locked.groupName;

      if (groupConflict) {
        hardConflicts.push({
          type: 'locked_slots',
          reason: `Locked slot conflict: Section ${locked.section} already has ${locked.courseCode} scheduled on ${dayNumberToName(locked.dayOfWeek)} period ${locked.startPeriod}.`,
          activityId: candidate.activityId,
        });
      }
    }
  }

  return {
    isValid: hardConflicts.length === 0,
    hardConflicts,
    softWarnings,
  };
}

/**
 * Validates a complete draft's assignments.
 */
export function validateDraft(
  assignments: ScheduleAssignment[],
  context: SolverInput
): ValidationResult {
  const hardConflicts: HardConflict[] = [];
  const softWarnings: SoftWarning[] = [];

  for (let i = 0; i < assignments.length; i++) {
    const candidate = assignments[i];
    const rest = assignments.slice(0, i).concat(assignments.slice(i + 1));
    const result = validateSlot(candidate, rest, context);
    hardConflicts.push(...result.hardConflicts);
    softWarnings.push(...result.softWarnings);
  }

  const uniqueHard = Array.from(new Map(hardConflicts.map((c) => [c.reason, c])).values());
  const uniqueSoft = Array.from(new Map(softWarnings.map((w) => [w.reason, w])).values());

  return {
    isValid: uniqueHard.length === 0,
    hardConflicts: uniqueHard,
    softWarnings: uniqueSoft,
  };
}
