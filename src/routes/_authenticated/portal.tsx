import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/school.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/chitti-ai/components/notification-bell";
import { AiAvatar } from "@/chitti-ai/components/ai-avatar";
import { PERSONAS, ROLE_LABELS } from "@/chitti-ai/personas";
import { StudentDashboard } from "@/portals/student-portal/student-dashboard";
import { ParentDashboard } from "@/portals/parent-portal/parent-dashboard";
import { StaffDashboard } from "@/portals/staff-portal/staff-dashboard";
import { ManagementDashboard } from "@/portals/management-portal/management-dashboard";
import logo from "@/assets/chitti-ai-logo.png";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "My portal · CHITTI AI School Assistant" },
      {
        name: "description",
        content:
          "Your CHITTI Public School portal: attendance at a glance, request status and your AI assistant.",
      },
      { property: "og:title", content: "My portal · CHITTI AI School Assistant" },
      {
        property: "og:description",
        content: "Attendance, requests and your school assistant in one place.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Portal not found.</div>,
  component: Portal,
});

function Portal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading your portal…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-8 text-sm text-destructive">{error?.message ?? "Failed to load."}</div>
    );
  }

  const persona = PERSONAS[data.role];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="CHITTI AI"
              width={36}
              height={36}
              className="size-9"
              loading="lazy"
            />
            <span className="font-display font-semibold">CHITTI AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ROLE_LABELS[data.role]}</Badge>
            <NotificationBell />
            <Button asChild size="sm">
              <Link to="/chat">Open assistant</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <AiAvatar role={data.role} className="size-16" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold">Hello, {data.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{persona.greeting}</p>
          </div>
        </div>

        {data.role === "student" ? <StudentDashboard data={data} /> : null}
        {data.role === "parent" ? <ParentDashboard data={data} /> : null}
        {data.role === "teacher" ? <StaffDashboard data={data} /> : null}
        {data.role === "principal" ? <ManagementDashboard data={data} /> : null}
      </section>
    </main>
  );
}
