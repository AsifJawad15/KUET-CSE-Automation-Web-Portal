import { ScheduleAssignment, SolverInput, SoftWarning } from './types';
import { getPeriodRange } from './periods';

/**
 * Calculates gaps in a list of periods.
 * Gaps are empty periods between the first and last active period.
 */
function calculateGaps(periods: number[]): number {
  if (periods.length <= 1) return 0;
  const sorted = [...new Set(periods)].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  let gaps = 0;
  for (let p = min + 1; p < max; p++) {
    if (!sorted.includes(p)) gaps++;
  }
  return gaps;
}

/**
 * Find length of the longest consecutive sequence in sorted periods.
 */
function getLongestConsecutive(periods: number[]): number {
  if (periods.length === 0) return 0;
  const sorted = [...new Set(periods)].sort((a, b) => a - b);
  let maxLen = 1;
  let currentLen = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentLen++;
    } else {
      maxLen = Math.max(maxLen, currentLen);
      currentLen = 1;
    }
  }
  return Math.max(maxLen, currentLen);
}

/**
 * Score a draft routine based on soft constraints.
 * Returns a score between 0 and 100.
 */
export function scoreDraft(
  assignments: ScheduleAssignment[],
  context: SolverInput
): { score: number; warnings: SoftWarning[] } {
  const warnings: SoftWarning[] = [];
  let totalPenalty = 0;

  // Retrieve active constraint weights
  const getWeight = (key: string, defaultWeight: number): number => {
    const c = context.constraints[key];
    if (c && !c.isActive) return 0;
    return c ? c.weight : defaultWeight;
  };

  const wStudentGap = getWeight('student_gap', 5);
  const wTeacherGap = getWeight('teacher_gap', 3);
  const wDayBalance = getWeight('day_balance', 4);
  const wConsecutive = getWeight('consecutive_periods', 10);
  const wMorningTheory = getWeight('morning_theory', 2);
  const wRoomPref = getWeight('room_preference', 5);
  const wLastPeriod = getWeight('last_period', 4);
  const wDaySpread = getWeight('course_day_spread', 8);

  const days = [0, 1, 2, 3, 4]; // Sun-Thu

  // Helper to map assignments to activities
  const getAct = (aId: string) => context.activities.find((act) => act.id === aId);

  // 1. Student Gaps & Consecutive Periods
  const groupNames = Array.from(
    new Set(context.activities.map((a) => a.groupName).filter(Boolean) as string[])
  );

  const groupsToTest = groupNames.length > 0 ? groupNames : [null];

  for (const day of days) {
    for (const group of groupsToTest) {
      const activePeriods: number[] = [];

      for (const asn of assignments) {
        if (asn.dayOfWeek !== day) continue;
        const act = getAct(asn.activityId);
        if (!act) continue;

        if (act.groupName === null || act.groupName === group) {
          activePeriods.push(...getPeriodRange(asn.startPeriod, asn.endPeriod));
        }
      }

      // Gaps
      const studentGaps = calculateGaps(activePeriods);
      if (studentGaps > 0 && wStudentGap > 0) {
        const penalty = studentGaps * wStudentGap;
        totalPenalty += penalty;
        warnings.push({
          type: 'student_gap',
          reason: `Section ${context.section} (${group || 'Whole'}) has ${studentGaps} empty period gaps on ${dayName(day)}.`,
          penalty,
          dayOfWeek: day,
        });
      }

      // Consecutive classes
      const longestConsec = getLongestConsecutive(activePeriods);
      if (longestConsec > 3 && wConsecutive > 0) {
        const excess = longestConsec - 3;
        const penalty = excess * wConsecutive;
        totalPenalty += penalty;
        warnings.push({
          type: 'consecutive_periods',
          reason: `Section ${context.section} (${group || 'Whole'}) has ${longestConsec} consecutive periods on ${dayName(day)} (preferred max 3).`,
          penalty,
          dayOfWeek: day,
        });
      }
    }
  }

  // 2. Teacher Gaps & Consecutive Periods
  const teachers = Array.from(
    new Set(context.activities.flatMap((a) => a.teachers.map((t) => t.teacherUserId)))
  );

  for (const tId of teachers) {
    const teacherName =
      context.activities
        .flatMap((a) => a.teachers)
        .find((t) => t.teacherUserId === tId)?.teacherName || 'Teacher';

    for (const day of days) {
      const activePeriods: number[] = [];

      // Gather from current draft assignments
      for (const asn of assignments) {
        if (asn.dayOfWeek !== day) continue;
        const act = getAct(asn.activityId);
        if (act && act.teachers.some((t) => t.teacherUserId === tId)) {
          activePeriods.push(...getPeriodRange(asn.startPeriod, asn.endPeriod));
        }
      }

      // Gather from locked slots (other sections taught by this teacher)
      for (const locked of context.lockedSlots) {
        if (locked.dayOfWeek === day && locked.teacherUserId === tId) {
          activePeriods.push(...getPeriodRange(locked.startPeriod, locked.endPeriod));
        }
      }

      // Teacher Gaps
      const teacherGaps = calculateGaps(activePeriods);
      if (teacherGaps > 0 && wTeacherGap > 0) {
        const penalty = teacherGaps * wTeacherGap;
        totalPenalty += penalty;
        warnings.push({
          type: 'teacher_gap',
          reason: `Dr./Prof. ${teacherName} has ${teacherGaps} empty period gaps on ${dayName(day)}.`,
          penalty,
          dayOfWeek: day,
        });
      }

      // Teacher Consecutive Classes
      const longestConsec = getLongestConsecutive(activePeriods);
      if (longestConsec > 3 && wConsecutive > 0) {
        const excess = longestConsec - 3;
        const penalty = excess * wConsecutive;
        totalPenalty += penalty;
        warnings.push({
          type: 'consecutive_periods',
          reason: `Dr./Prof. ${teacherName} has ${longestConsec} consecutive classes on ${dayName(day)} (preferred max 3).`,
          penalty,
          dayOfWeek: day,
        });
      }
    }
  }

  // 3. Day Load Balance
  const periodsPerDay = days.map((day) => {
    const dayAsn = assignments.filter((a) => a.dayOfWeek === day);
    return dayAsn.reduce((sum, a) => {
      const act = getAct(a.activityId);
      return sum + (act ? act.duration : 1);
    }, 0);
  });

  const maxPeriods = Math.max(...periodsPerDay);
  const minPeriods = Math.min(...periodsPerDay);
  const imbalance = maxPeriods - minPeriods;

  if (imbalance > 1 && wDayBalance > 0) {
    const penalty = (imbalance - 1) * wDayBalance;
    totalPenalty += penalty;
    warnings.push({
      type: 'day_balance',
      reason: `Schedule is slightly unbalanced across the week. Max day load: ${maxPeriods} periods, Min: ${minPeriods} periods.`,
      penalty,
    });
  }

  // 4. Theory Period Preference & Room Preferences & Last Period
  for (const asn of assignments) {
    const act = getAct(asn.activityId);
    if (!act) continue;

    // A. Theory period preference (theory in morning, i.e., periods 1-3)
    if (act.courseType === 'Theory' && wMorningTheory > 0) {
      if (asn.startPeriod >= 4 && asn.startPeriod <= 6) {
        const penalty = wMorningTheory;
        totalPenalty += penalty;
        warnings.push({
          type: 'morning_theory',
          reason: `Theory class ${act.courseCode} scheduled in midday period ${asn.startPeriod}.`,
          penalty,
          activityId: asn.activityId,
          dayOfWeek: asn.dayOfWeek,
          startPeriod: asn.startPeriod,
        });
      } else if (asn.startPeriod >= 7) {
        const penalty = wMorningTheory * 2.5;
        totalPenalty += penalty;
        warnings.push({
          type: 'morning_theory',
          reason: `Theory class ${act.courseCode} scheduled in late afternoon period ${asn.startPeriod}.`,
          penalty,
          activityId: asn.activityId,
          dayOfWeek: asn.dayOfWeek,
          startPeriod: asn.startPeriod,
        });
      }
    }

    // B. Room preference
    if (act.preferredRoomNumbers.length > 0 && wRoomPref > 0) {
      if (!act.preferredRoomNumbers.includes(asn.roomNumber)) {
        const penalty = wRoomPref;
        totalPenalty += penalty;
        warnings.push({
          type: 'room_preference',
          reason: `Course ${act.courseCode} is not scheduled in preferred room (${act.preferredRoomNumbers.join(', ')}). Got Room ${asn.roomNumber}.`,
          penalty,
          activityId: asn.activityId,
        });
      }
    }

    // C. Last period check
    if (asn.endPeriod === 9 && wLastPeriod > 0) {
      const penalty = wLastPeriod;
      totalPenalty += penalty;
      warnings.push({
        type: 'last_period',
        reason: `Course ${act.courseCode} scheduled in the last period of the day (period 9).`,
        penalty,
        activityId: asn.activityId,
        dayOfWeek: asn.dayOfWeek,
        startPeriod: asn.startPeriod,
      });
    }
  }

  // 5. Course Day Spread (theory and lab of same course on different days)
  if (wDaySpread > 0) {
    const courseIds = Array.from(new Set(context.activities.map((a) => a.courseId)));
    for (const cId of courseIds) {
      const courseAsns = assignments.filter((a) => getAct(a.activityId)?.courseId === cId);
      if (courseAsns.length > 1) {
        const daysUsed = Array.from(new Set(courseAsns.map((a) => a.dayOfWeek)));
        if (daysUsed.length < courseAsns.length) {
          const courseCode = getAct(courseAsns[0].activityId)?.courseCode || '';
          const penalty = wDaySpread;
          totalPenalty += penalty;
          warnings.push({
            type: 'course_day_spread',
            reason: `Multiple components (theory/lab) of course ${courseCode} are scheduled on the same day.`,
            penalty,
          });
        }
      }
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

  return {
    score,
    warnings,
  };
}

function dayName(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] || '';
}
