REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.current_email() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_view_student(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_mark_student(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;