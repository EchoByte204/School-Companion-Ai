# 🏫 XYZ AI — Human-Like AI School Assistant

**XYZ AI (Chitti AI)** is a standalone Applied AI solution built to function like a real human school front-desk assistant. It seamlessly interacts with **Students, Parents, Teachers, and School Management/Principals** via **Interactive Chat, Voice, and an AI Avatar**. Powered by **Google Gemini 3.6 Flash** for reasoning & tool calling, and **Google Gemini 3.1 Flash TTS** for speech synthesis, XYZ AI delivers personalized, contextual, and secure administrative and academic support.

---

## 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [User Roles](#4-user-roles)
5. [AI Workflow](#5-ai-workflow)
6. [Voice & Avatar](#6-voice--avatar)
7. [Mock APIs](#7-mock-apis)
8. [Security](#8-security)
9. [Multilingual Support](#9-multilingual-support)
10. [Installation](#10-installation)
11. [Environment Variables](#11-environment-variables)
12. [How to Run](#12-how-to-run)
13. [Test Credentials](#13-test-credentials)
14. [Demo Video](#14-demo-video)
15. [GitHub Repository](#15-github-repository)
16. [Limitations / Future Improvements](#16-limitations--future-improvements)

---

## 1. Project Overview

XYZ AI is designed to automate school inquiries and administrative actions with human-like warmth, empathy, and high security. It handles routine inquiries (e.g., student attendance, marks, schedule), performs authorized administrative operations (e.g., marking daily attendance), provides school-wide management analytics, and seamlessly escalates complex or sensitive requests to human staff when requested.

---

## 2. Features

- 🧠 **Natural Language Intent Detection:** Understands complex queries, remembers conversation context, handles follow-up questions, and asks for clarification.
- 🎭 **Dynamic AI Personas:** Adapts tone, style, and permissions based on user role (Student, Parent, Teacher, Principal).
- 🎙️ **Voice & Avatar Integration:** Speech-to-Text (STT) voice input combined with real-time animated AI Avatar and Gemini TTS output.
- 💬 **Synchronized Karaoke Subtitles:** Real-time typewriter subtitle streaming synchronized with voice audio playback.
- 🛡️ **Multi-Layer Application Security:** Role-based tool authorization at the server layer with Supabase Row-Level Security (RLS).
- 🔄 **Multi-Key Auto-Rotation:** Seamless failover across multiple Gemini API keys to eliminate rate limits (429 errors).
- 📞 **Human Escalation System:** Dispatches mock calls and support ticket requests to real teachers or school management upon confirmation.
- 📊 **Management Analytics & PDF Reports:** Comprehensive attendance visualization and downloadable PDF summary reports for school principals.

---

## 3. Architecture

XYZ AI is built as a modern, unified web application organized into a modular 5-repository directory structure:

```
School ERP Ecosystem
├── 01. Student Repository
│   └── student-portal          (src/portals/student-portal)
├── 02. Parent Repository
│   └── parent-portal           (src/portals/parent-portal)
├── 03. Management Repository
│   └── management-portal       (src/portals/management-portal)
├── 04. Staff Repository
│   └── staff-portal / Teacher  (src/portals/staff-portal)
└── 05. XYZ AI Repository
    └── xyz-ai                  (src/xyz-ai & src/chitti-ai)
```

### Technology Stack
- **Frontend Framework:** React 19, Tailwind CSS, Motion (Framer Motion), Lucide Icons, Sonner.
- **Fullstack Framework:** TanStack Start, Vite.
- **AI Gateway & LLM:** Google Gemini 3.6 Flash via `@ai-sdk/google` & Vercel AI SDK. Optional local LLM via Ollama (`USE_LOCAL_MODEL=true`).
- **Text-to-Speech Engine:** Google Gemini 3.1 Flash TTS (`gemini-3.1-flash-tts-preview`).
- **Database & Authentication:** Supabase PostgreSQL with Row Level Security (RLS) & JWT Authentication.

---

## 4. User Roles

| Role | Persona Name | Tone & Style | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Student** | Academic Assistant | Friendly, encouraging, supportive | View own attendance, check assignment schedule, query subject grades. |
| **Parent** | Parent Support Assistant | Caring, patient, reassuring | View child's attendance, check fee status, request callbacks from class teacher. |
| **Teacher** | Teaching Assistant | Professional, concise, organized | Mark daily student attendance, manage call requests, inspect class rosters. |
| **Principal** | Management Assistant | Authoritative, analytical, strategic | View school-wide attendance metrics, track staff reports, export PDF analytics. |

---

## 5. AI Workflow

```
[ User Request (Text / Voice) ]
              │
              ▼
[ Speech-to-Text (STT) ]  (If Voice Input)
              │
              ▼
[ Role Identification & JWT Validation ]
              │
              ▼
[ Persona Selection & Tool Schema Injection ]
              │
              ▼
[ Gemini 3.6 Flash Intent Detection & Tool Execution ]
              │
              ├──► Query Mock School API / Database (RLS Checked)
              │
              ▼
[ Generate Natural Response & Context Update ]
              │
              ├──► Text-to-Speech Synthesis (Gemini 3.1 TTS)
              └──► Subtitle Audio Sync & Avatar Animation
```

---

## 6. Voice & Avatar

- **Interactive Avatar:** Animated visual representation with real-time lip-sync, dynamic facial expression states (speaking, listening, thinking, idle), and pulse visualizers.
- **Speech-to-Text (STT):** Built-in browser Web Speech API & audio transcription endpoint for hands-free voice commands.
- **Text-to-Speech (TTS):** Google Gemini 3.1 Flash TTS streams high-fidelity natural speech responses.
- **Synchronized Karaoke Subtitles:** Character-by-character subtitle typing synced with speech timing.

---

## 7. Mock APIs

XYZ AI interacts with a comprehensive set of mock services:

1. `get_student_attendance`: Fetches attendance records, dates, and overall percentages for students/children.
2. `mark_attendance`: Server-authorized endpoint for teachers to mark student attendance (Present/Absent).
3. `get_school_analytics`: Provides aggregate attendance percentages, class performance, and total headcount for management.
4. `escalate_to_human`: Triggers a confirmed mock call or notification ticket to a teacher or school management representative.

---

## 8. Security

Security is programmatically enforced at the **application, database, and tool layers** rather than relying solely on LLM prompt instructions:

| Threat / Requirement | Enforcement Mechanism |
| :--- | :--- |
| **1. Prompt Injection** | System prompts bind the caller's role to the authenticated JWT session. Server-side tool execution throws a `ForbiddenError` if non-permitted tools are invoked. |
| **2. Unauthorized Data Access** | Database queries strictly evaluate Supabase Row-Level Security (RLS). Students/Parents can only read rows matching their own `student_id` or guardian email. |
| **3. System-Prompt Extraction** | Output filters and prompt guidelines explicitly reject requests to dump system instructions or tool definitions. |
| **4. API Key Protection** | All API keys (`GEMINI_API_KEYS`, `VITE_SUPABASE_URL`) reside exclusively in server handlers (`src/routes/api/*`) and are never exposed in client bundles. |
| **5. Fake Role Claims** | Role identity is verified directly from signed Supabase JWT headers (`Authorization: Bearer <jwt>`) via `getActor(request)`. Prompt-claimed roles are ignored. |
| **6. Unauthorized Actions** | Restricted tools (`mark_attendance`, `get_school_analytics`) are dynamically omitted from non-authorized roles during tool schema creation (`tools.server.ts`). |

---

## 9. Multilingual Support

XYZ AI understands natural conversational queries and responds natively in **11 major languages**:

- English
- Hindi (हिंदी)
- Hinglish
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Marathi (मराठी)
- Bengali (বাংলা)
- Gujarati (ગુજરાતી)
- Punjabi (ਪੰਜਾਬੀ)
- Kannada (ಕನ್ನಡ)
- Malayalam (മലയാളം)
- Urdu (اردو)

---

## 10. Installation

### Prerequisites
- **Node.js:** v20.x or v22.x
- **npm:** v10.x or **Bun**

### Step-by-Step Installation

```bash
# Clone the repository
git clone https://github.com/EchoByte204/School-Companion-Ai.git

# Navigate into the project folder
cd School-Companion-Ai

# Install dependencies
npm install
```

---

## 11. Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Google Gemini Multi-Key Configuration (Auto-rotates on 429 rate limits)
GEMINI_API_KEYS="AIzaSyKey1..., AIzaSyKey2..., AIzaSyKey3..."
GEMINI_MODEL="gemini-3.6-flash"
GEMINI_TTS_MODEL="gemini-3.1-flash-tts-preview"

# Supabase Credentials
VITE_SUPABASE_URL="https://bejmwgvkjsmuzzfnywwh.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"

# Optional Local Model Override (Ollama)
USE_LOCAL_MODEL="false"
OLLAMA_BASE_URL="http://localhost:11434/v1"
```

---

## 12. How to Run

### Development Mode
```bash
npm run dev
```
Open `http://localhost:8080` (or `http://localhost:3000`) in your web browser.

### Production Build
```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

---

## 13. Test Credentials

You can test all four personas using the shared demo password:

**Shared Password:** `Chitti@2026`

| Persona | Email | Role & Details |
| :--- | :--- | :--- |
| **Parent** | `gurmeet.parent@xyzschool.test` | Gurmeet Singh (Parent of Harpreet Singh, Class 10-A) |
| **Student** | `harpreet.student@xyzschool.test` | Harpreet Singh (Class 10-A, Roll: 10A-01) |
| **Teacher** | `meera.teacher@xyzschool.test` | Meera Iyer (Class Teacher, Mathematics) |
| **Principal** | `principal@xyzschool.test` | Dr. S. Ramanathan (School-Wide Analytics) |

---

## 14. Demo Video

📹 **Watch the Working Demo Video:**  
👉 **[▶️ Watch XYZ AI Demonstration Video on Google Drive](https://drive.google.com/file/d/1fO5ySVLQ9MROEsCVRhvDnYdSSWMGCgo8/view?usp=sharing)**

> **Video Highlights:** Demonstrates live voice interaction with the AI Avatar, karaoke subtitle typing synchronization, role-based attendance checking for Parents & Students, attendance marking for Teachers, management analytics for Principals, and human staff escalation.

---

## 15. GitHub Repository

- **Repository Link:** [https://github.com/EchoByte204/School-Companion-Ai.git](https://github.com/EchoByte204/School-Companion-Ai.git)
- **Primary Branch:** `main`

---

## 16. Limitations / Future Improvements

- **Full WebRTC Audio Duplexing:** Upgrade from Web Speech API + TTS streaming to low-latency WebRTC bidirectional audio streaming.
- **Live SMS/WhatsApp Gateway:** Integrate real Twilio / WhatsApp Business APIs for instant teacher notification dispatches on escalation.
- **Offline 3D WebGL Avatar Engine:** Enhance avatar rendering with 3D Canvas / Three.js morph target lip-synchronization.
