-- Create notifications when exam room assignments are published or updated.

CREATE OR REPLACE FUNCTION public.create_exam_room_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course_code text;
  v_course_title text;
  v_term text;
  v_section text;
  v_target_type text;
  v_target_value text;
  v_target_year_term text;
  v_room_text text;
  v_event_key text;
BEGIN
  IF NEW.exam_date IS NULL OR NEW.exam_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.room_numbers IS NULL OR array_length(NEW.room_numbers, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND coalesce(OLD.room_numbers, ARRAY[]::text[]) = coalesce(NEW.room_numbers, ARRAY[]::text[])
     AND OLD.exam_date IS NOT DISTINCT FROM NEW.exam_date
     AND OLD.exam_time IS NOT DISTINCT FROM NEW.exam_time THEN
    RETURN NEW;
  END IF;

  SELECT c.code, c.title, co.term, co.section
  INTO v_course_code, v_course_title, v_term, v_section
  FROM public.course_offerings co
  JOIN public.courses c ON c.id = co.course_id
  WHERE co.id = NEW.offering_id;

  IF v_course_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_section IS NOT NULL AND btrim(v_section) <> '' THEN
    v_target_type := 'SECTION';
    v_target_value := btrim(v_section);
    v_target_year_term := v_term;
  ELSE
    v_target_type := 'COURSE';
    v_target_value := v_course_code;
    v_target_year_term := NULL;
  END IF;

  v_room_text := array_to_string(NEW.room_numbers, ', ');
  v_event_key := format(
    'exam-room:%s:%s:%s:%s',
    NEW.id,
    NEW.exam_date::text,
    to_char(NEW.exam_time, 'HH24:MI'),
    v_room_text
  );

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.type = 'exam_room_assigned'
      AND n.metadata->>'event_key' = v_event_key
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    type,
    title,
    body,
    target_type,
    target_value,
    target_year_term,
    created_by,
    created_by_role,
    metadata
  ) VALUES (
    'exam_room_assigned',
    format('Exam room assigned for %s', v_course_code),
    format(
      '%s is scheduled on %s at %s in room %s.',
      coalesce(v_course_title, v_course_code),
      NEW.exam_date::text,
      to_char(NEW.exam_time, 'HH24:MI'),
      v_room_text
    ),
    v_target_type,
    v_target_value,
    v_target_year_term,
    NULL,
    'ADMIN',
    jsonb_build_object(
      'event_key', v_event_key,
      'exam_id', NEW.id,
      'offering_id', NEW.offering_id,
      'course_code', v_course_code,
      'course_title', v_course_title,
      'exam_date', NEW.exam_date,
      'exam_time', to_char(NEW.exam_time, 'HH24:MI'),
      'room_numbers', NEW.room_numbers,
      'name', NEW.name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_room_notification ON public.exams;

CREATE TRIGGER trg_exam_room_notification
AFTER INSERT OR UPDATE OF exam_date, exam_time, room_numbers ON public.exams
FOR EACH ROW
EXECUTE FUNCTION public.create_exam_room_notification();