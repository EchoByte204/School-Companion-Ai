-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('student', 'parent', 'teacher', 'principal');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE public.support_target AS ENUM ('teacher', 'management');
CREATE TYPE public.support_status AS ENUM ('pending', 'acknowledged', 'resolved');

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_email()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce((SELECT email FROM public.profiles WHERE id = auth.uid()), ''));
$$;

-- ============ teachers ============
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  login_email TEXT,
  phone TEXT,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- ============ classes ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'A',
  teacher_id UUID REFERENCES public.teachers ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============ students ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  class_id UUID REFERENCES public.classes ON DELETE SET NULL,
  login_email TEXT,
  parent_name TEXT,
  parent_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- ============ attendance ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT current_date,
  status public.attendance_status NOT NULL,
  note TEXT,
  marked_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============ support requests ============
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  requester_role public.app_role NOT NULL,
  target public.support_target NOT NULL,
  teacher_id UUID REFERENCES public.teachers ON DELETE SET NULL,
  student_id UUID REFERENCES public.students ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  contact_phone TEXT,
  status public.support_status NOT NULL DEFAULT 'pending',
  reference_code TEXT NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- ============ chat ============
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  client_message_id TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_thread_idx ON public.chat_messages (thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============ visibility helpers ============
CREATE OR REPLACE FUNCTION public.can_view_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    LEFT JOIN public.teachers t ON t.id = c.teacher_id
    WHERE s.id = _student_id
      AND (
        s.user_id = auth.uid()
        OR (s.parent_email IS NOT NULL AND lower(s.parent_email) = public.current_email()
            AND public.has_role(auth.uid(), 'parent'))
        OR (public.has_role(auth.uid(), 'teacher') AND t.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'principal')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_mark_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    JOIN public.teachers t ON t.id = c.teacher_id
    WHERE s.id = _student_id
      AND (
        (public.has_role(auth.uid(), 'teacher') AND t.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'principal')
      )
  );
$$;

-- ============ policies ============
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "teachers_select_authenticated" ON public.teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_select_authenticated" ON public.classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "students_select_visible" ON public.students FOR SELECT TO authenticated USING (public.can_view_student(id));

CREATE POLICY "attendance_select_visible" ON public.attendance FOR SELECT TO authenticated USING (public.can_view_student(student_id));
CREATE POLICY "attendance_insert_staff" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.can_mark_student(student_id) AND marked_by = auth.uid());
CREATE POLICY "attendance_update_staff" ON public.attendance FOR UPDATE TO authenticated USING (public.can_mark_student(student_id)) WITH CHECK (public.can_mark_student(student_id));

CREATE POLICY "support_insert_own" ON public.support_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "support_select_own_or_staff" ON public.support_requests FOR SELECT TO authenticated USING (
  requester_id = auth.uid()
  OR public.has_role(auth.uid(), 'principal')
  OR (public.has_role(auth.uid(), 'teacher') AND teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY "support_update_staff" ON public.support_requests FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'principal')
  OR (public.has_role(auth.uid(), 'teacher') AND teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
) WITH CHECK (true);

CREATE POLICY "threads_own" ON public.chat_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_select_own" ON public.chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "messages_insert_own" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_delete_own" ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER attendance_touch BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER support_touch BEFORE UPDATE ON public.support_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER threads_touch BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ new user handling ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email TEXT := lower(coalesce(NEW.email, ''));
  _name TEXT := coalesce(NEW.raw_user_meta_data->>'full_name', split_part(coalesce(NEW.email, 'friend'), '@', 1));
  _requested TEXT := coalesce(NEW.raw_user_meta_data->>'role', '');
  _role public.app_role := 'student';
  _seeded_teacher public.teachers;
  _seeded_student public.students;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, preferred_language)
  VALUES (NEW.id, _name, coalesce(NEW.email, ''), coalesce(NEW.raw_user_meta_data->>'preferred_language', 'en'))
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO _seeded_teacher FROM public.teachers WHERE lower(login_email) = _email LIMIT 1;
  SELECT * INTO _seeded_student FROM public.students WHERE lower(login_email) = _email LIMIT 1;

  IF _seeded_teacher.id IS NOT NULL THEN
    UPDATE public.teachers SET user_id = NEW.id WHERE id = _seeded_teacher.id;
    _role := CASE WHEN _seeded_teacher.is_principal THEN 'principal'::public.app_role ELSE 'teacher'::public.app_role END;
  ELSIF _seeded_student.id IS NOT NULL THEN
    UPDATE public.students SET user_id = NEW.id WHERE id = _seeded_student.id;
    _role := 'student';
  ELSIF EXISTS (SELECT 1 FROM public.students WHERE lower(parent_email) = _email) THEN
    _role := 'parent';
  ELSIF _requested IN ('student', 'parent', 'teacher', 'principal') THEN
    _role := _requested::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ seed demo school ============
INSERT INTO public.teachers (id, full_name, subject, login_email, phone, is_principal) VALUES
  ('11111111-1111-4111-8111-000000000001', 'Meera Iyer', 'Mathematics', 'meera.teacher@xyzschool.test', '+91 98000 11001', false),
  ('11111111-1111-4111-8111-000000000002', 'Arun Deshpande', 'Science', 'arun.teacher@xyzschool.test', '+91 98000 11002', false),
  ('11111111-1111-4111-8111-000000000003', 'Fatima Khan', 'English', 'fatima.teacher@xyzschool.test', '+91 98000 11003', false),
  ('11111111-1111-4111-8111-000000000004', 'Dr. S. Ramanathan', 'School Management', 'principal@xyzschool.test', '+91 98000 11000', true);

INSERT INTO public.classes (id, name, section, teacher_id) VALUES
  ('22222222-2222-4222-8222-000000000001', 'Grade 8', 'A', '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000002', 'Grade 9', 'B', '11111111-1111-4111-8111-000000000002'),
  ('22222222-2222-4222-8222-000000000003', 'Grade 10', 'A', '11111111-1111-4111-8111-000000000003');

INSERT INTO public.students (id, full_name, roll_no, class_id, login_email, parent_name, parent_email) VALUES
  ('33333333-3333-4333-8333-000000000001', 'Rahul Sharma', '8A-01', '22222222-2222-4222-8222-000000000001', 'rahul.student@xyzschool.test', 'Anita Sharma', 'anita.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000002', 'Priya Sharma', '9B-04', '22222222-2222-4222-8222-000000000002', 'priya.student@xyzschool.test', 'Anita Sharma', 'anita.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000003', 'Aditya Nair', '8A-02', '22222222-2222-4222-8222-000000000001', NULL, 'Suresh Nair', 'suresh.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000004', 'Sneha Reddy', '8A-03', '22222222-2222-4222-8222-000000000001', NULL, 'Lakshmi Reddy', 'lakshmi.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000005', 'Imran Ali', '8A-04', '22222222-2222-4222-8222-000000000001', NULL, 'Yusuf Ali', 'yusuf.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000006', 'Kavya Menon', '9B-01', '22222222-2222-4222-8222-000000000002', NULL, 'Radha Menon', 'radha.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000007', 'Rohan Gupta', '9B-02', '22222222-2222-4222-8222-000000000002', NULL, 'Vikram Gupta', 'vikram.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000008', 'Ananya Das', '9B-03', '22222222-2222-4222-8222-000000000002', NULL, 'Bipasha Das', 'bipasha.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000009', 'Harpreet Singh', '10A-01', '22222222-2222-4222-8222-000000000003', NULL, 'Gurmeet Singh', 'gurmeet.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000010', 'Divya Patel', '10A-02', '22222222-2222-4222-8222-000000000003', NULL, 'Nilesh Patel', 'nilesh.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000011', 'Karthik Raman', '10A-03', '22222222-2222-4222-8222-000000000003', NULL, 'Sudha Raman', 'sudha.parent@xyzschool.test'),
  ('33333333-3333-4333-8333-000000000012', 'Zoya Sheikh', '10A-04', '22222222-2222-4222-8222-000000000003', NULL, 'Nadia Sheikh', 'nadia.parent@xyzschool.test');

INSERT INTO public.attendance (student_id, attendance_date, status)
SELECT s.id,
       d::date,
       CASE
         WHEN (abs(hashtext(s.id::text || d::text)) % 100) < 8 THEN 'absent'::public.attendance_status
         WHEN (abs(hashtext(s.id::text || d::text)) % 100) < 13 THEN 'late'::public.attendance_status
         ELSE 'present'::public.attendance_status
       END
FROM public.students s
CROSS JOIN generate_series(current_date - INTERVAL '44 days', current_date - INTERVAL '1 day', INTERVAL '1 day') AS d
WHERE extract(isodow FROM d) < 6
ON CONFLICT (student_id, attendance_date) DO NOTHING;