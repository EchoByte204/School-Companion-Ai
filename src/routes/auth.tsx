import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/chitti-ai/languages";
import { ROLE_LABELS, type AppRole } from "@/chitti-ai/personas";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/chitti-ai/demo-accounts";
import logo from "@/assets/chitti-ai-logo.png";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/portal";
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · CHITTI AI School Assistant" },
      {
        name: "description",
        content:
          "Sign in to CHITTI AI to chat with your school assistant as a student, parent, teacher or principal.",
      },
      { property: "og:title", content: "Sign in · CHITTI AI School Assistant" },
      {
        property: "og:description",
        content: "Access your role-aware school assistant for attendance, updates and support.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const destination = safeRedirect(search.redirect);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("parent");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: destination, replace: true });
    });
  }, [destination, navigate]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void navigate({ to: destination, replace: true });
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${destination}`,
        data: { full_name: fullName, role, preferred_language: language },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. If email confirmation is on, check your inbox.");
    const { data } = await supabase.auth.getSession();
    if (data.session) void navigate({ to: destination, replace: true });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(destination)}`,
    });
    setBusy(false);
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: destination, replace: true });
  };

  const signInDemoAccount = async (account: DemoAccount) => {
    setBusy(true);
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    let result = await supabase.auth.signInWithPassword({
      email: account.email,
      password: DEMO_PASSWORD,
    });
    if (result.error) {
      const created = await supabase.auth.signUp({
        email: account.email,
        password: DEMO_PASSWORD,
        options: {
          emailRedirectTo: `${window.location.origin}${destination}`,
          data: { full_name: account.name, role: account.role, preferred_language: language },
        },
      });
      if (created.error) {
        setBusy(false);
        toast.error(created.error.message);
        return;
      }
      result = await supabase.auth.signInWithPassword({
        email: account.email,
        password: DEMO_PASSWORD,
      });
    }
    setBusy(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Signed in as ${account.name} (${ROLE_LABELS[account.role]})`);
    void navigate({ to: destination, replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <img src={logo} alt="CHITTI AI" width={40} height={40} className="size-10" />
          <span className="font-display text-lg font-semibold">CHITTI AI</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-center font-display text-xl font-semibold">
            Welcome to CHITTI Public School
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Sign in and your assistant will already know who you are.
          </p>

          <Button variant="outline" className="mt-5 w-full" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={() => void signIn()}>
                Sign in
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                  id="signup-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>I am a</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((option) => (
                        <SelectItem key={option} value={option}>
                          {ROLE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.nativeLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                School staff and demo accounts are recognised by their school email, so the correct
                role is applied automatically.
              </p>
              <Button className="w-full" disabled={busy} onClick={() => void signUp()}>
                Create account
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Demo accounts</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Password for all demo logins:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">{DEMO_PASSWORD}</code>
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  variant="outline"
                  size="sm"
                  className="justify-between"
                  disabled={busy}
                  onClick={() => void signInDemoAccount(account)}
                >
                  <span>{ROLE_LABELS[account.role]}</span>
                  <span className="truncate text-xs text-muted-foreground">{account.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
