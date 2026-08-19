import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AiAvatar } from "@/chitti-ai/components/ai-avatar";
import { PERSONAS, ROLE_LABELS, type AppRole } from "@/chitti-ai/personas";
import { LANGUAGES } from "@/chitti-ai/languages";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/chitti-ai/demo-accounts";
import logo from "@/assets/chitti-ai-logo.png";
import { MessageCircle, Mic, ShieldCheck, UserRoundCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CHITTI AI — Human-Like School Assistant" },
      {
        name: "description",
        content:
          "A human-like school assistant for students, parents, teachers and management. Chat, voice and avatar support in 11 Indian languages.",
      },
      { property: "og:title", content: "CHITTI AI — Human-Like School Assistant" },
      {
        property: "og:description",
        content:
          "Attendance answers, teacher escalation and school analytics through natural chat, voice and an AI avatar.",
      },
    ],
  }),
  component: Landing,
});

const ROLE_ORDER: AppRole[] = ["student", "parent", "teacher", "principal"];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="CHITTI AI" width={40} height={40} className="size-10" />
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold">CHITTI AI</p>
            <p className="text-xs text-muted-foreground">CHITTI Public School</p>
          </div>
        </div>
        <Button asChild>
          <Link to={signedIn ? "/portal" : "/auth"}>{signedIn ? "Open my portal" : "Sign in"}</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.15fr_1fr] md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-accent" /> Role-aware · Human-like · 11 languages
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-5xl">
            The school assistant that speaks like a person, not a portal.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            CHITTI AI greets students, reassures parents, saves teachers time and briefs management
            — over chat, voice or a talking avatar. It answers only what your account is allowed to
            see and hands you to a real human the moment you ask.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => void navigate({ to: signedIn ? "/portal" : "/auth" })}>
              {signedIn ? "Open my portal" : "Start a conversation"}
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#roles">See how each role is treated</a>
            </Button>
          </div>

          <dl className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                title: "Chat",
                body: "Threaded conversations that remember the discussion.",
              },
              { icon: Mic, title: "Voice", body: "Speak your question, hear the answer back." },
              {
                icon: UserRoundCheck,
                title: "Escalation",
                body: "One line and a real teacher is looped in.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                <item.icon className="size-5 text-accent" />
                <dt className="mt-2 font-display text-sm font-semibold">{item.title}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-border bg-gradient-to-b from-card to-surface p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <AiAvatar role="parent" state="speaking" level={0.35} className="size-32" />
            <div className="w-full space-y-3 text-left text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground">
                Was my daughter absent this week?
              </p>
              <p className="max-w-[90%] rounded-2xl bg-surface px-3.5 py-2 text-surface-foreground">
                Let me check for you. Divya was marked absent on Tuesday and late on Thursday — her
                attendance this month is 92%. Would you like me to inform her class teacher?
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="text-2xl font-semibold">One assistant, four personalities</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The tone, the tools and the data change with who is signed in. Nothing a user asks can
          widen that access.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_ORDER.map((role) => {
            const persona = PERSONAS[role];
            return (
              <article key={role} className="rounded-2xl border border-border bg-card p-5">
                <AiAvatar role={role} className="size-14" />
                <h3 className="mt-3 font-display text-base font-semibold">{ROLE_LABELS[role]}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {persona.title}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{persona.greeting}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Can ask: “{persona.suggestions[0]}”
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-xl font-semibold">Try the demo school</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use these accounts with the shared demo password{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
              {DEMO_PASSWORD}
            </code>
            . The role, class and family links are applied automatically on first sign-in.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li
                key={account.email}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="font-medium">{ROLE_LABELS[account.role]}</span>
                <code className="truncate text-xs text-muted-foreground">{account.email}</code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Languages available: {LANGUAGES.map((language) => language.nativeLabel).join(" · ")}
          </p>
        </div>
      </section>
    </main>
  );
}
