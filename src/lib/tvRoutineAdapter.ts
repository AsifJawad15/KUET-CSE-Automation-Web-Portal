import type { RoutineDisplaySlot } from '../../shared/tv-display/domain';
import type { DBRoutineSlotWithDetails } from '@/types/database';

export function routineDisplaySlotToDb(slot: RoutineDisplaySlot): DBRoutineSlotWithDetails {
  return {
    id: slot.id,
    offering_id: '',
    room_number: slot.roomNumber,
    day_of_week: 0,
    start_time: slot.startTime,
    end_time: slot.endTime,
    section: slot.section,
    valid_from: slot.date,
    valid_until: slot.date,
    created_at: slot.date,
    course_offerings: {
      id: '',
      term: slot.term || '',
      session: slot.session || '',
      batch: null,
      courses: {
        code: slot.courseCode,
        title: slot.courseTitle,
        credit: 0,
        course_type: slot.bookingType || 'Theory',
      },
      teachers: { full_name: slot.teacherName || '', teacher_uid: '' },
    },
    rooms: { room_number: slot.roomNumber, room_type: null },
  };
}
