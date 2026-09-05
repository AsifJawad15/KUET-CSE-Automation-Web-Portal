import {
  SolverInput,
  SolverDraft,
  ScheduleActivity,
  ScheduleAssignment,
  SolverMetrics,
} from './types';
import { validateSlot, validateDraft } from './conflictValidator';
import { scoreDraft } from './scoring';
import { periodsOverlap } from './periods';

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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

    const allowedRooms = isLab ? context.options.labRooms : context.options.theoryRooms;
    if (allowedRooms?.length) eligibleRooms = eligibleRooms.filter(r => allowedRooms.includes(r.room_number));

    // 3. General domain generation
    for (const day of days) {
      // Define valid start/end periods
      const timeSlots: [number, number][] = [];
      if (isLab) {
        timeSlots.push([1, 3], [4, 6], [7, 9]); // Lab blocks
      } else {
        for (let p = 1; p + act.duration - 1 <= 9; p++) {
          timeSlots.push([p, p + act.duration - 1]); // Theory blocks
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
  timeoutMs: number,
  rng: () => number,
  metrics: SolverMetrics,
  maxNodes: number
): Map<string, ScheduleAssignment> | null {
  if (metrics.nodes >= maxNodes) { metrics.termination = 'node_budget'; return null; }
  metrics.nodes++;
  // Interactive requests retain a wall-clock guard; fixture runs use nodes only.
  if (Date.now() - startTime > timeoutMs) {
    metrics.termination = 'timeout';
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
  const shuffledValues = shuffleArray(nextActDomain, rng);

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

      metrics.prunedValues += uDom.length - filteredUDom.length;
      if (filteredUDom.length === 0) {
        consistent = false;
        break;
      }
      nextDomains.set(u.id, filteredUDom);
    }

    if (consistent) {
      const result = backtrack(assigned, newUnassigned, nextDomains, context, startTime, timeoutMs, rng, metrics, maxNodes);
      if (result) return result;
    }

    // Undo assignment (Backtrack)
    assigned.delete(nextAct.id);
    metrics.backtracks++;
    if (metrics.termination === 'node_budget' || metrics.termination === 'timeout') return null;
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
  timeoutTotalMs = 25000,
  metrics: SolverMetrics = createSolverMetrics(context.options.seed ?? 0)
): SolverDraft[] {
  if (!Number.isInteger(maxDrafts) || maxDrafts < 1 || maxDrafts > 5) throw new Error('draftCount must be 1 through 5');
  const seed = context.options.seed ?? 0;
  const maxNodes = context.options.maxNodes ?? 100000;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be an unsigned 32-bit integer');
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 1000000) throw new Error('maxNodes must be 1 through 1000000');
  Object.assign(metrics, createSolverMetrics(seed));
  const rng = mulberry32(seed);
  if (context.options.deterministic) timeoutTotalMs = Infinity;
  if (!context.activities.length || new Set(context.activities.map(a => a.id)).size !== context.activities.length) throw new Error('Activities must be nonempty with unique IDs');
  for (const a of context.activities) {
    if (!Number.isInteger(a.duration) || a.duration < 1 || a.duration > 9 ||
        !['Theory', 'Lab', 'Sessional'].includes(a.courseType) ||
        (a.courseType !== 'Theory' && a.duration !== 3)) throw new Error('Invalid activity type or duration');
  }
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
      metrics.termination = 'infeasible';
      metrics.elapsedMs = Date.now() - startTotal;
      return [];
    }
  }

  // Pre-sort activities by descending duration (Labs first) to speed up CSP search
  const sortedActivities = [...context.activities].sort((a, b) => b.duration - a.duration);

  let attempt = 0;
  const seenFingerprints = new Set<string>();

  while (drafts.length < maxDrafts && attempt < maxAttempts) {
    attempt++;
    metrics.attempts = attempt;
    const remainingTime = timeoutTotalMs - (Date.now() - startTotal);
    if (remainingTime <= 0) { metrics.termination = 'timeout'; break; } // Not enough time for another full backtracking search

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
      context.options.deterministic ? Infinity : Math.min(4000, remainingTime),
      rng, metrics, maxNodes
    );

    if (metrics.termination === 'node_budget' || metrics.termination === 'timeout') break;
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
        if (!validation.isValid) throw new Error('Solver produced an invalid draft');
        const { score, warnings, totalPenalty, components } = scoreDraft(assignments, context);

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
          score, totalPenalty, penaltyComponents: components,
          assignments,
          hardConflictCount: validation.hardConflicts.length,
          softWarningCount: warnings.length + validation.softWarnings.length,
          summary: {
            reason: summaryText,
            advantages,
            disadvantages,
          },
        });
      }
    }
  }

  metrics.elapsedMs = Date.now() - startTotal;
  if (!drafts.length && metrics.termination === 'completed') metrics.termination = 'infeasible';
  // Sort drafts by descending score
  return drafts.sort((a, b) => (a.totalPenalty ?? 0) - (b.totalPenalty ?? 0));
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSolverMetrics(seed: number): SolverMetrics {
  return { seed, nodes: 0, backtracks: 0, prunedValues: 0, attempts: 0, elapsedMs: 0, termination: 'completed' };
}
