import { SupabaseClient } from '@supabase/supabase-js';
import {
  SolverInput,
  ScheduleActivity,
  Room,
  LockedSlot,
  TeacherAvailability,
  CourseScheduleRequirement,
  SolverOptions,
} from './types';
import { PERIODS } from '@/modules/ClassRoutine/constants';

/**
 * Maps HH:MM:SS or HH:MM string to period numbers.
 */
function timeToPeriod(start: string, end: string): { startPeriod: number; endPeriod: number } {
  const sStr = start.substring(0, 5);
  const eStr = end.substring(0, 5);

  const startPeriod = PERIODS.find((p) => p.start === sStr)?.id || 1;
  const endPeriod = PERIODS.find((p) => p.end === eStr)?.id || startPeriod;

  return { startPeriod, endPeriod };
}

/**
 * Load database entities and construct SolverInput.
 */
export async function buildSolverInput(
  supabase: SupabaseClient,
  session: string,
  year: number,
  term: number,
  section: string,
  options: SolverOptions
): Promise<SolverInput> {
  const targetTermStr = `${year}-${term}`;

  // 1. Fetch Course Offerings for selected term/session/section
  const { data: offerings, error: offError } = await supabase
    .from('course_offerings')
    .select(`
      id, course_id, teacher_user_id, term, session, batch, section,
      courses (id, code, title, credit, course_type),
      teachers (user_id, full_name, teacher_uid)
    `)
    .eq('session', session)
    .eq('term', targetTermStr)
    .in('section', ['A', 'B'])
    .eq('is_active', true);

  if (offError) throw offError;
  const validOfferings = offerings || [];

  // 2. Fetch Rooms
  const { data: dbRooms, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true);

  if (roomError) throw roomError;
  const rooms: Room[] = (dbRooms || []).map((r) => ({
    room_number: r.room_number,
    building_name: r.building_name,
    capacity: r.capacity,
    room_type: r.room_type as any,
    is_active: r.is_active,
  }));

  // 3. Fetch Teacher Availability
  const { data: dbAvail, error: availError } = await supabase
    .from('teacher_availability')
    .select('*');

  // If table does not exist or has error, handle gracefully
  const teacherAvailabilities: TeacherAvailability[] = (dbAvail || []).map((a) => ({
    teacherUserId: a.teacher_user_id,
    dayOfWeek: a.day_of_week,
    startPeriod: a.start_period,
    endPeriod: a.end_period,
    availabilityType: a.availability_type as any,
    priority: a.priority,
    note: a.note,
  }));

  // 4. Fetch Course Schedule Requirements
  const { data: dbReqs } = await supabase
    .from('course_schedule_requirements')
    .select('*')
    .eq('session', session)
    .eq('year', year)
    .eq('term', term)
    .in('section', ['A', 'B']);

  const requirements: CourseScheduleRequirement[] = (dbReqs || []).map((r) => ({
    id: r.id,
    session: r.session,
    year: r.year,
    term: r.term,
    section: r.section,
    courseId: r.course_id,
    courseOfferingId: r.course_offering_id,
    courseType: r.course_type,
    requiredTheorySlots: r.required_theory_slots,
    requiredLabSlots: r.required_lab_slots,
    labDurationPeriods: r.lab_duration_periods,
    theoryDurationPeriods: r.theory_duration_periods,
    needsCombinedSection: r.needs_combined_section,
    labGroups: r.lab_groups || [],
    preferredRoomType: r.preferred_room_type,
    preferredRoomNumbers: r.preferred_room_numbers || [],
    priority: r.priority,
  }));

  // 5. Fetch Constraints
  const { data: dbConstraints } = await supabase
    .from('routine_constraints')
    .select('*');

  const constraints: Record<string, { isActive: boolean; weight: number }> = {};
  if (dbConstraints) {
    for (const c of dbConstraints) {
      constraints[c.constraint_key] = {
        isActive: c.is_active,
        weight: c.weight,
      };
    }
  }

  // 6. Fetch Locked slots (Routine slots of other batches/sections)
  // Join course_offerings to filter on session
  const { data: allSlots, error: slotsError } = await supabase
    .from('routine_slots')
    .select(`
      id, offering_id, room_number, day_of_week, start_time, end_time, section,
      course_offerings!inner (
        id, term, session, batch,
        courses (code, title, credit, course_type),
        teachers (user_id, full_name, teacher_uid)
      )
    `)
    .eq('course_offerings.session', session);

  if (slotsError) throw slotsError;

  const lockedSlots: LockedSlot[] = [];
  const existingTargetSlots: LockedSlot[] = [];

  if (allSlots) {
    for (const slot of allSlots) {
      const co = slot.course_offerings as any;
      if (!co) continue;

      const { startPeriod, endPeriod } = timeToPeriod(slot.start_time, slot.end_time);

      const mapped: LockedSlot = {
        id: slot.id,
        courseCode: co.courses?.code || '',
        teacherUserId: co.teachers?.user_id || '',
        teacherName: co.teachers?.full_name || 'Unknown',
        roomNumber: slot.room_number,
        dayOfWeek: slot.day_of_week,
        startPeriod,
        endPeriod,
        term: co.term,
        session: co.session,
        section: slot.section,
      };

      const isTargetSelection = co.term === targetTermStr && (slot.section === 'A' || slot.section === 'B');
      if (isTargetSelection) {
        existingTargetSlots.push(mapped);
      } else {
        lockedSlots.push(mapped);
      }
    }
  }

  // 7. Build Activities to schedule
  // For each course offering in this section, check requirements.
  // Group offerings by course_id (if combined) or by course_id + section.
  const activities: ScheduleActivity[] = [];
  const courseOfferingGroups = new Map<string, any[]>();

  for (const off of validOfferings) {
    const cid = off.course_id;
    const req = requirements.find((r) => r.courseId === cid);
    const isCombined = req?.needsCombinedSection || false;

    const groupKey = isCombined ? cid : `${cid}|${off.section || 'whole'}`;
    const existingGroup = courseOfferingGroups.get(groupKey) || [];
    existingGroup.push(off);
    courseOfferingGroups.set(groupKey, existingGroup);
  }

  for (const [groupKey, group] of courseOfferingGroups.entries()) {
    const firstOff = group[0];
    const course = firstOff.courses;
    const courseId = firstOff.course_id;

    // Find requirement row for this course
    const req = requirements.find((r) => r.courseId === courseId);

    const isCombined = req ? req.needsCombinedSection : false;
    const isLabCourse = (code: string, type?: string): boolean => {
      const typeLower = type?.toLowerCase() || '';
      if (typeLower === 'lab' || typeLower === 'sessional') return true;
      const digits = code.replace(/\D/g, '');
      if (digits.length > 0) {
        const lastDigit = parseInt(digits[digits.length - 1], 10);
        return lastDigit % 2 === 0; // Even digit is lab, odd is theory
      }
      return false;
    };
    const isLab = isLabCourse(course.code, course.course_type);

    const requiredTheory = req ? req.requiredTheorySlots : (isLab ? 0 : Math.ceil(course.credit || 3));
    const requiredLab = req ? req.requiredLabSlots : (isLab ? 1 : 0);
    const labGroups = req && req.labGroups && req.labGroups.length > 0 
      ? req.labGroups 
      : (isLab ? (firstOff.section === 'B' ? ['B1', 'B2'] : ['A1', 'A2']) : []);

    const preferredRoomType = req?.preferredRoomType || null;
    let preferredRooms = req?.preferredRoomNumbers || [];

    if (isLab) {
      if (options.labRooms && options.labRooms.length > 0) {
        preferredRooms = options.labRooms;
      }
    } else {
      if (options.theoryRooms && options.theoryRooms.length > 0) {
        preferredRooms = options.theoryRooms;
      }
    }

    // Map teachers list
    const teachersList = group.map((off) => ({
      teacherUserId: off.teachers?.user_id || off.teacher_user_id,
      teacherName: off.teachers?.full_name || 'Unknown',
      teacherUid: off.teachers?.teacher_uid || 'T-unknown',
      courseOfferingId: off.id,
      section: off.section,
    }));

    const actSection = isCombined ? null : firstOff.section;

    if (isLab) {
      // For labs, if there are multiple groups, schedule them as separate activities.
      if (labGroups.length > 0) {
        for (const grp of labGroups) {
          for (let i = 0; i < requiredLab; i++) {
            activities.push({
              id: `${firstOff.id}-lab-${grp}-${i}`,
              courseId,
              courseCode: course.code,
              courseTitle: course.title,
              courseType: 'Lab',
              duration: req?.labDurationPeriods || 3,
              teachers: teachersList,
              groupName: grp,
              isCombined: false,
              preferredRoomType,
              preferredRoomNumbers: preferredRooms,
              section: actSection,
            });
          }
        }
      } else {
        // Fallback: single lab activity for whole section
        for (let i = 0; i < requiredLab; i++) {
          activities.push({
            id: `${firstOff.id}-lab-whole-${i}`,
            courseId,
            courseCode: course.code,
            courseTitle: course.title,
            courseType: 'Lab',
            duration: req?.labDurationPeriods || 3,
            teachers: teachersList,
            groupName: null,
            isCombined: false,
            preferredRoomType,
            preferredRoomNumbers: preferredRooms,
            section: actSection,
          });
        }
      }
    } else {
      // Theory classes
      for (let i = 0; i < requiredTheory; i++) {
        activities.push({
          id: `${firstOff.id}-theory-${i}`,
          courseId,
          courseCode: course.code,
          courseTitle: course.title,
          courseType: 'Theory',
          duration: req?.theoryDurationPeriods || 1,
          teachers: teachersList,
          groupName: null,
          isCombined,
          preferredRoomType,
          preferredRoomNumbers: preferredRooms,
          section: actSection,
        });
      }
    }
  }

  // 8. If including existing selected slots (options.includeExistingSelectedSlots is true),
  // we add them as pre-assigned and remove them from variables to solve.
  // For simplicity in the solver, we will pass existingTargetSlots as part of lockedSlots,
  // which will block those spaces from being modified, if needed.
  if (options.includeExistingSelectedSlots) {
    lockedSlots.push(...existingTargetSlots);
  }

  return {
    session,
    year,
    term,
    section,
    activities,
    rooms,
    lockedSlots,
    teacherAvailabilities,
    constraints,
    options,
  };
}
