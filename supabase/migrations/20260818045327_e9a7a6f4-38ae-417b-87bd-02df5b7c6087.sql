GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_mark_student(uuid) TO authenticated;