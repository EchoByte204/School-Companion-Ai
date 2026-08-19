-- 1. request status: add rejected
ALTER TYPE public.support_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. chat thread summaries
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;

-- 3. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'request_status',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  request_reference TEXT,
  request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- 4. notify on request creation and status change
CREATE OR REPLACE FUNCTION public.notify_support_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, request_reference, request_id)
    VALUES (NEW.requester_id, 'request_submitted',
            'Request submitted: ' || NEW.subject,
            'Reference ' || NEW.reference_code || '. We will update you as soon as a human reviews it.',
            NEW.reference_code, NEW.id);

    IF NEW.target = 'teacher' AND NEW.teacher_id IS NOT NULL THEN
      SELECT user_id INTO _staff FROM public.teachers WHERE id = NEW.teacher_id;
      IF _staff IS NOT NULL AND _staff <> NEW.requester_id THEN
        INSERT INTO public.notifications (user_id, kind, title, body, request_reference, request_id)
        VALUES (_staff, 'request_inbox', 'New request: ' || NEW.subject,
                'Reference ' || NEW.reference_code || ' needs your review.', NEW.reference_code, NEW.id);
      END IF;
    ELSE
      FOR _staff IN
        SELECT t.user_id FROM public.teachers t
        WHERE t.is_principal AND t.user_id IS NOT NULL AND t.user_id <> NEW.requester_id
      LOOP
        INSERT INTO public.notifications (user_id, kind, title, body, request_reference, request_id)
        VALUES (_staff, 'request_inbox', 'New request: ' || NEW.subject,
                'Reference ' || NEW.reference_code || ' needs management review.', NEW.reference_code, NEW.id);
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, kind, title, body, request_reference, request_id)
    VALUES (NEW.requester_id, 'request_status',
            'Request ' || NEW.reference_code || ' is now ' || NEW.status::text,
            NEW.subject, NEW.reference_code, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_requests_notify ON public.support_requests;
CREATE TRIGGER support_requests_notify
AFTER INSERT OR UPDATE OF status ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_support_request();

-- 5. richer demo data: extra teacher + class + students
INSERT INTO public.teachers (full_name, subject, login_email, phone, is_principal)
SELECT 'Nandini Rao', 'Science', 'nandini.teacher@xyzschool.test', '+91 98200 44112', false
WHERE NOT EXISTS (SELECT 1 FROM public.teachers WHERE login_email = 'nandini.teacher@xyzschool.test');

INSERT INTO public.classes (name, section, teacher_id)
SELECT 'Grade 9', 'C', (SELECT id FROM public.teachers WHERE login_email = 'nandini.teacher@xyzschool.test')
WHERE NOT EXISTS (SELECT 1 FROM public.classes WHERE name = 'Grade 9' AND section = 'C');

INSERT INTO public.students (full_name, roll_no, class_id, parent_name, parent_email)
SELECT s.full_name, s.roll_no,
       (SELECT id FROM public.classes WHERE name = 'Grade 9' AND section = 'C'),
       s.parent_name, s.parent_email
FROM (VALUES
  ('Ishaan Verma', '9C-01', 'Rakesh Verma', 'rakesh.parent@xyzschool.test'),
  ('Meera Nair', '9C-02', 'Sujata Nair', 'sujata.parent@xyzschool.test'),
  ('Aarav Joshi', '9C-03', 'Nilesh Joshi', 'nilesh.parent@xyzschool.test'),
  ('Fatima Sheikh', '9C-04', 'Imran Sheikh', 'imran.parent@xyzschool.test'),
  ('Rohan Das', '9C-05', 'Sanjay Das', 'sanjay.parent@xyzschool.test')
) AS s(full_name, roll_no, parent_name, parent_email)
WHERE NOT EXISTS (SELECT 1 FROM public.students st WHERE st.roll_no = s.roll_no);

-- 6. 90 days of attendance history for every student (weekdays only)
INSERT INTO public.attendance (student_id, attendance_date, status, note)
SELECT st.id,
       d::date,
       CASE
         WHEN (abs(hashtext(st.id::text || d::text)) % 100) < 84 THEN 'present'::public.attendance_status
         WHEN (abs(hashtext(st.id::text || d::text)) % 100) < 92 THEN 'late'::public.attendance_status
         ELSE 'absent'::public.attendance_status
       END,
       NULL
FROM public.students st
CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE, INTERVAL '1 day') AS d
WHERE EXTRACT(ISODOW FROM d) < 6
ON CONFLICT (student_id, attendance_date) DO NOTHING;