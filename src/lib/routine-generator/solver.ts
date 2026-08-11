import {
  SolverInput,
  SolverDraft,
  ScheduleActivity,
  ScheduleAssignment,
  Room,
} from './types';
import { validateSlot, validateDraft } from './conflictValidator';
import { scoreDraft } from './scoring';
import { periodsOverlap } from './periods';

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates initial domains for each activity based on room type, periods, teacher availability,
 * and locked combined-section slots.
 */
function generateDomains(context: SolverInput): Map<string, ScheduleAssignment[]> {
  const domains = new Map<string, ScheduleAssignment[]>();
  const { allowSaturday = false, respectTeacherAvailability = true } = context.options || {};

  const days = [0, 1, 2, 3, 4]; // Sun-Thu
  if (allowSaturday) days.push(6); // Sat

  for (const act of context.activities) {
    const actDomain: ScheduleAssignment[] = [];
    const isLab = act.courseType === 'Lab' || act.courseType === 'Sessional';

    // 1. Determine eligible rooms
    let eligibleRooms = context.rooms.filter((r) => {
      if (!r.is_active) return false;
      const isLabRoom = r.room_type === 'lab';
      if (isLab) return isLabRoom;
      return !isLabRoom;
    });

    if (act.preferredRoomNumbers && act.preferredRoomNumbers.length > 0) {
      eligibleRooms = eligibleRooms.filter((r) => act.preferredRoomNumbers.includes(r.room_number));
    }

    // 2. Combined section constraint: Check if this course is already scheduled/locked in another section
    // If so, we MUST align with it! We restrict domain to ONLY that locked slot's time and room.
    const lockedClassMatch = context.lockedSlots.filter(
      (ls) => ls.courseCode === act.courseCode && act.isCombined
    );

    if (lockedClassMatch.length > 0) {
      // Find the ones that aren't already mapped to avoid double-binding.
      // Simply: the domain of this activity consists only of these locked slot configurations
      for (const locked of lockedClassMatch) {
        // Find if this locked room is in our rooms list
        const roomExists = context.rooms.some((r) => r.room_number === locked.roomNumber);
        if (!roomExists) continue;

        actDomain.push({
          activityId: act.id,
          dayOfWeek: locked.dayOfWeek,
          startPeriod: locked.startPeriod,
          endPeriod: locked.endPeriod,
          roomNumber: locked.roomNumber,
        });
      }

      if (actDomain.length > 0) {
        domains.set(act.id, actDomain);
        continue; // Domain fully locked, skip general generation
      }
    }

    // 3. General domain generation
    for (const day of days) {
      // Define valid start/end periods
      const timeSlots: [number, number][] = [];
      if (isLab) {
        timeSlots.push([1, 3], [4, 6], [7, 9]); // Lab blocks
      } else {
        for (let p = 1; p <= 9; p++) {
          timeSlots.push([p, p]); // Theory blocks
        }
      }

      for (const [start, end] of timeSlots) {
        // Filter out if teacher is unavailable at this time
        if (respectTeacherAvailability) {
          const unavailable = act.teachers.some((t) =>
            context.teacherAvailabilities.some(
              (av) =>
                av.teacherUserId === t.teacherUserId &&
                av.dayOfWeek === day &&
                av.availabilityType === 'unavailable' &&
                periodsOverlap(start, end, av.startPeriod, av.endPeriod)
            )
          );
          if (unavailable) continue;
        }

        for (const room of eligibleRooms) {
          // Filter out if room is occupied by a locked slot at this time
          const roomBusy = context.lockedSlots.some(
            (ls) =>
              ls.roomNumber === room.room_number &&
              ls.dayOfWeek === day &&
              periodsOverlap(start, end, ls.startPeriod, ls.endPeriod)
          );
          if (roomBusy) continue;

          actDomain.push({
            activityId: act.id,
            dayOfWeek: day,
            startPeriod: start,
            endPeriod: end,
            roomNumber: room.room_number,
          });
        }
      }
    }

    domains.set(act.id, actDomain);
  }

  return domains;
}

/**
 * Backtracking Solver Function
 */
function backtrack(
  assigned: Map<string, ScheduleAssignment>,
  unassigned: ScheduleActivity[],
  domains: Map<string, ScheduleAssignment[]>,
  context: SolverInput,
  startTime: number,
  timeoutMs: number
): Map<string, ScheduleAssignment> | null {
  // Check timeout
  if (Date.now() - startTime > timeoutMs) {
    return null;
  }

  if (unassigned.length === 0) {
    return assigned;
  }

  // MRV Heuristic: Choose variable with the smallest remaining domain
  unassigned.sort((a, b) => {
    const da = domains.get(a.id)?.length || 0;
    const db = domains.get(b.id)?.length || 0;
    return da - db;
  });

  const nextAct = unassigned[0];
  const nextActDomain = domains.get(nextAct.id) || [];

  if (nextActDomain.length === 0) {
    return null; // Dead end, backtrack
  }

  // Value Ordering: Shuffle the values to produce varied recommendations across runs
  const shuffledValues = shuffleArray([...nextActDomain]);

  for (const val of shuffledValues) {
    const assignedList = Array.from(assigned.values());
    const valResult = validateSlot(val, assignedList, context);

    if (!valResult.isValid) continue;

    // Apply assignment
    assigned.set(nextAct.id, val);

    // Forward checking
    const newUnassigned = unassigned.slice(1);
    const nextDomains = new Map<string, ScheduleAssignment[]>();
    let consistent = true;

    for (const u of newUnassigned) {
      const uDom = domains.get(u.id) || [];
      const filteredUDom = uDom.filter((v) => {
        // Validate this value against the new assignment
        const checkResult = validateSlot(v, [val], context);
        return checkResult.isValid;
      });

      if (filteredUDom.length === 0) {
        consistent = false;
        break;
      }
      nextDomains.set(u.id, filteredUDom);
    }

    if (consistent) {
      const result = backtrack(assigned, newUnassigned, nextDomains, context, startTime, timeoutMs);
      if (result) return result;
    }

    // Undo assignment (Backtrack)
    assigned.delete(nextAct.id);
  }

  return null;
}

/**
 * Solve CSP Routine Generation.
 * Returns 3-5 distinct SolverDrafts.
 */
export function generateRoutineRecommendations(
  context: SolverInput,
  maxDrafts = 5,
  timeoutTotalMs = 25000
): SolverDraft[] {
  const drafts: SolverDraft[] = [];
  const startTotal = Date.now();
  const maxAttempts = maxDrafts * 4; // Run up to 20 search attempts to find distinct ones

  // Generate domains
  const baseDomains = generateDomains(context);

  // Check if any activity starts with an empty domain
  for (const act of context.activities) {
    const dom = baseDomains.get(act.id);
    if (!dom || dom.length === 0) {
      // Immediately fail if an activity has no possible values
      console.warn(`Activity ${act.courseCode} has an empty initial domain.`);
      return [];
    }
  }

  // Pre-sort activities by descending duration (Labs first) to speed up CSP search
  const sortedActivities = [...context.activities].sort((a, b) => b.duration - a.duration);

  let attempt = 0;
  const seenFingerprints = new Set<string>();

  while (drafts.length < maxDrafts && attempt < maxAttempts) {
    attempt++;
    const remainingTime = timeoutTotalMs - (Date.now() - startTotal);
    if (remainingTime < 2000) break; // Not enough time for another full backtracking search

    const startTime = Date.now();
    const assignedMap = new Map<string, ScheduleAssignment>();

    // Copy domains to prevent modification between runs
    const domainsCopy = new Map<string, ScheduleAssignment[]>();
    for (const [k, v] of baseDomains) {
      domainsCopy.set(k, [...v]);
    }

    const solution = backtrack(
      assignedMap,
      [...sortedActivities],
      domainsCopy,
      context,
      startTime,
      Math.min(4000, remainingTime) // Max 4 seconds per single draft attempt
    );

    if (solution) {
      const assignments = Array.from(solution.values());

      // Create fingerprint of assignments to check uniqueness
      const fingerprint = assignments
        .map((a) => `${a.activityId}:${a.dayOfWeek}:${a.startPeriod}:${a.roomNumber}`)
        .sort()
        .join('|');

      if (!seenFingerprints.has(fingerprint)) {
        seenFingerprints.add(fingerprint);

        // Grade the assignment
        const validation = validateDraft(assignments, context);
        const { score, warnings } = scoreDraft(assignments, context);

        // Summarize draft features
        const advantages: string[] = [];
        const disadvantages: string[] = [];

        if (score >= 85) {
          advantages.push('Excellent overall schedule structure.');
        } else if (score >= 70) {
          advantages.push('Good balance of classes.');
        }

        const studentGapWarningCount = warnings.filter((w) => w.type === 'student_gap').length;
        const teacherGapWarningCount = warnings.filter((w) => w.type === 'teacher_gap').length;

        if (studentGapWarningCount === 0) {
          advantages.push('No student class gaps found.');
        } else {
          disadvantages.push(`${studentGapWarningCount} student gap warnings.`);
        }

        if (teacherGapWarningCount === 0) {
          advantages.push('No teacher gaps found.');
        } else {
          disadvantages.push(`${teacherGapWarningCount} teacher gap warnings.`);
        }

        const balanceWarning = warnings.find((w) => w.type === 'day_balance');
        if (!balanceWarning) {
          advantages.push('Perfectly balanced daily class load.');
        } else {
          disadvantages.push('Slightly unbalanced class distribution.');
        }

        const summaryText = advantages.slice(0, 2).join(', ') + 
          (disadvantages.length > 0 ? `. Note: ${disadvantages.slice(0, 1).join('')}` : '.');

        drafts.push({
          name: `Recommendation Draft ${drafts.length + 1}`,
          score,
          assignments,
          hardConflictCount: validation.hardConflicts.length,
          softWarningCount: warnings.length,
          summary: {
            reason: summaryText,
            advantages,
            disadvantages,
          },
        });
      }
    }
  }

  // Sort drafts by descending score
  return drafts.sort((a, b) => b.score - a.score);
}
