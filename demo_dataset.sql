-- ====================================================================
-- CHITTI AI — Complete Demo Dataset & Schema Seed Script
-- School Companion AI System
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SCHEMAS & TABLES
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    section TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, section)
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    roll_no TEXT UNIQUE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    guardian_name TEXT,
    guardian_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'parent', 'teacher', 'principal')),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    note TEXT,
    marked_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'rejected')),
    assigned_to UUID,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT DEFAULT 'New Conversation',
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES
CREATE POLICY "Public read classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Public read user_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Users read own requests" ON public.support_requests FOR SELECT USING (true);
CREATE POLICY "Users insert requests" ON public.support_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Users read own threads" ON public.chat_threads FOR SELECT USING (true);
CREATE POLICY "Users insert threads" ON public.chat_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Users insert messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- 5. SAMPLE SEED DATA

-- Insert Classes
INSERT INTO public.classes (id, name, section) VALUES
('c0000000-0000-0000-0000-000000000001', '10', 'A'),
('c0000000-0000-0000-0000-000000000002', '9', 'B'),
('c0000000-0000-0000-0000-000000000003', '8', 'A')
ON CONFLICT (name, section) DO NOTHING;

-- Insert Students
INSERT INTO public.students (id, full_name, roll_no, class_id, guardian_name, guardian_email) VALUES
('s0000000-0000-0000-0000-000000000001', 'Harpreet Singh', '10A-01', 'c0000000-0000-0000-0000-000000000001', 'Gurmeet Singh', 'gurmeet.parent@xyzschool.test'),
('s0000000-0000-0000-0000-000000000002', 'Divya Patel', '10A-02', 'c0000000-0000-0000-0000-000000000001', 'Nilesh Patel', 'nilesh.parent@xyzschool.test'),
('s0000000-0000-0000-0000-000000000003', 'Karthik Raman', '10A-03', 'c0000000-0000-0000-0000-000000000001', 'Sudha Raman', 'sudha.parent@xyzschool.test'),
('s0000000-0000-0000-0000-000000000004', 'Priya Sharma', '9B-04', 'c0000000-0000-0000-0000-000000000002', 'Anita Sharma', 'anita.parent@xyzschool.test'),
('s0000000-0000-0000-0000-000000000005', 'Rahul Sharma', '8A-01', 'c0000000-0000-0000-0000-000000000003', 'Anita Sharma', 'anita.parent@xyzschool.test')
ON CONFLICT (roll_no) DO NOTHING;

-- Insert Seed Attendance Records (Past 30 Days)
DO $$
DECLARE
    curr_date DATE := CURRENT_DATE - INTERVAL '30 days';
    student_record RECORD;
BEGIN
    WHILE curr_date <= CURRENT_DATE LOOP
        -- Skip weekends
        IF EXTRACT(ISODOW FROM curr_date) < 6 THEN
            FOR student_record IN SELECT id FROM public.students LOOP
                INSERT INTO public.attendance (student_id, attendance_date, status, note)
                VALUES (
                    student_record.id,
                    curr_date,
                    CASE 
                        WHEN RANDOM() < 0.88 THEN 'present'
                        WHEN RANDOM() < 0.94 THEN 'late'
                        ELSE 'absent'
                    END,
                    CASE 
                        WHEN RANDOM() > 0.9 THEN 'Medical reason'
                        ELSE NULL
                    END
                )
                ON CONFLICT (student_id, attendance_date) DO NOTHING;
            END LOOP;
        END IF;
        curr_date := curr_date + INTERVAL '1 day';
    END LOOP;
END $$;
