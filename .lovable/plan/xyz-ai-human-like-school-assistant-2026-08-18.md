# XYZ AI — Human-Like School Assistant

A single Lovable app that hosts the whole School ERP AI ecosystem: role-based login, a human-like chat assistant, voice input/output, an animated 2D avatar, mock school APIs, and escalation to real teachers/management. Multilingual across the 11 required languages.

## What gets built

### 1. Auth and roles

- Email/password sign-up and sign-in, plus Google sign-in.
- Roles stored in a separate `user_roles` table (`student | parent | teacher | principal`) — never on the profile — and checked server-side by a security-definer `has_role()` function.
- Signed-in users land on their portal; the role decides which persona, tools, and data they can reach.

### 2. Portals (the five repositories, as route folders)

Lovable builds one deployable app, so the repository tree maps to a clean folder layout inside it rather than five separate repos:

```text
src/
  portals/
    student-portal/
    parent-portal/
    management-portal/
    staff-portal/          (teacher)
  xyz-ai/                  (assistant core: personas, tools, guards, voice, avatar)
  routes/
    index.tsx              landing
    auth.tsx               sign in / sign up
    _authenticated/
      student/  parent/  teacher/  principal/
      chat/$threadId.tsx   shared assistant surface
```

Each portal has its own dashboard (attendance summary, class list, analytics) plus the assistant.

### 3. Threaded chat assistant

- Sidebar of conversations, "New chat", each thread on its own URL (`/chat/:threadId`), messages persisted in the cloud database and scoped to the signed-in user.
- Streaming replies, typing indicator, markdown rendering, built on AI Elements chat primitives.
- Human-like behaviour: greets by name, remembers context in the thread, handles follow-ups and corrections, asks for missing info (e.g. which child, which date) instead of guessing.
- Personas by role: supportive Academic Assistant (student), caring Parent Support (parent), professional Teaching Assistant (teacher), Management Assistant (principal).

### 4. Voice + animated 2D avatar

- Mic capture → speech-to-text → assistant → text-to-speech → spoken reply.
- Custom-illustrated 2D avatar (no generic sparkle icon) with idle breathing, listening/thinking/speaking states, and mouth animation driven by live audio amplitude for lip-sync feel.
- Toggle between chat mode and avatar/voice mode; barge-in stop button.

### 5. Mock school services (real tables, mock data)

Seeded demo school: students, parents, teachers, classes, attendance records, call requests.
Assistant tools, each authorization-checked in code before touching data:

- `get_my_attendance` — student only, own record.
- `get_child_attendance` — parent only, only their linked children.
- `mark_attendance` — teacher only, only students in their class.
- `get_school_analytics` — principal only, aggregate figures.
- `request_teacher_call` / `request_management_contact` — creates a real row; the assistant only confirms success after the service returns confirmation.

### 6. Escalation flow

When a user is unsatisfied or the query needs a human, the assistant offers "Talk to Teacher" / "Contact School Management" as buttons, asks for confirmation, then submits the request. Teachers and principals see incoming requests in their portal with status handling.

### 7. Language support

Language selector for English, Hindi, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Kannada, Malayalam, Urdu. The assistant replies in the selected language (auto-detects when the user switches mid-conversation), and speech recognition/synthesis follow the same choice.

### 8. Security and safety

- Every tool authorizes at the application layer using the server-verified session and role — the model can never grant itself access, and fake role claims in chat are ignored.
- Row-level security on every table plus explicit grants; parents see only their own children, teachers only their own classes.
- System prompt and API keys never returned: prompt-injection and prompt-extraction guardrails, output filtering, and refusal of instructions embedded in user data.
- All AI calls run server-side; no key ever reaches the browser.

## Design

Warm, trustworthy school-tech look — not a generic AI chat clone. Deep indigo and soft teal palette on a light paper background, rounded cards, friendly geometric headline type, distinct accent color per persona. Full dark mode via semantic tokens.

## Technical notes

- Lovable Cloud for database, auth, and storage; migrations create tables with grants, RLS, and literal seed rows for the demo school.
- Chat streaming through a TanStack server route with the AI SDK on the Lovable AI Gateway; tool calling with authorization inside each tool's execute.
- Speech-to-text and text-to-speech through Lovable AI, called from server functions only.
- Server-side rate limiting is not added unless requested.
- Thorough README written in-repo covering setup, architecture, personas, tools, security model, and demo script.

## Build order

1. Cloud + schema + seed demo school, roles, RLS.
2. Auth, role routing, portal shells.
3. Assistant core: personas, tools, authorization, streaming chat with threads.
4. Escalation flows and teacher/principal request inboxes.
5. Voice + animated avatar.
6. Language support, security hardening, polish, README.
