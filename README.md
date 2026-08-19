# 🏫 CHITTI AI — School Companion & Voice AI Assistant

**CHITTI AI** is a state-of-the-art AI-powered School Companion Assistant built to serve Parents, Students, Teachers, and Principals. Powered by **Google Gemini 3.6 Flash** for reasoning & tool calling, and **Google Gemini 3.1 Flash TTS** for real-time voice speech synthesis, CHITTI AI delivers a seamless, human-like, multi-lingual school front-desk experience.

---

## ✨ Key Features

- 🧠 **Google Gemini 3.6 Flash Integration:** High-speed, 10/10 accuracy AI reasoning and function calling.
- 🎙️ **Google Gemini 3.1 Flash TTS (Voice Reply):** Real-time Text-to-Speech audio streaming with dedicated multi-key auto-rotation.
- 💬 **Synchronized Typewriter Subtitles:** Karaoke-style text typing animation synchronized with spoken voice speech.
- 🔄 **Multi-Key Auto-Rotation & 429 Failover:** Rotates across multiple Gemini API keys automatically if rate limits occur.
- 🌐 **Multi-Lingual Support:** Speaks and understands Hindi, Hinglish, English, Tamil, Telugu, and regional languages naturally.
- 🛡️ **Strict Server-Side Access Control (RLS):** Student data is securely isolated by user roles (Student, Parent, Teacher, Principal).
- 📊 **School ERP Dashboard & PDF Export:** Comprehensive attendance analytics with downloadable PDF reports.
- ⚡ **Local Model Support (Ollama):** Optional 100% offline local model execution via `OLLAMA_BASE_URL`.

---

## 🔑 Demo Credentials

Access pre-configured demo personas with the shared demo password:

**Shared Password:** `Chitti@2026`

| Persona       | Email                             | Role & Details                                       |
| :------------ | :-------------------------------- | :--------------------------------------------------- |
| **Parent**    | `gurmeet.parent@xyzschool.test`   | Gurmeet Singh (Parent of Harpreet Singh, Class 10-A) |
| **Student**   | `harpreet.student@xyzschool.test` | Harpreet Singh (Class 10-A, Roll: 10A-01)            |
| **Teacher**   | `meera.teacher@xyzschool.test`    | Meera Iyer (Class Teacher, Mathematics)              |
| **Principal** | `principal@xyzschool.test`        | Dr. S. Ramanathan (School-Wide Analytics)            |

---

## 🚀 Quick Start Guide

### 1. Prerequisites

- **Node.js:** v20.x or v22.x
- **npm:** 10.x or bun

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Google Gemini Multi-Key Configuration
GEMINI_API_KEYS="AIzaSyKey1..., AIzaSyKey2..., AIzaSyKey3..."
GEMINI_MODEL="gemini-3.6-flash"
GEMINI_TTS_MODEL="gemini-3.1-flash-tts-preview"

# Optional Local Model Override
USE_LOCAL_MODEL="false"
OLLAMA_BASE_URL="http://localhost:11434/v1"
```

### 3. Installation & Local Execution

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open `http://localhost:8080` in your browser.

---

## 🗄️ Database Setup & Demo Dataset

The complete schema and demo seed dataset are provided in [`demo_dataset.sql`](file:///d:/projects/New%20folder/School%20Companion%20AI/demo_dataset.sql).

To initialize your database:

1. Open your Supabase Dashboard or PostgreSQL console.
2. Run the SQL script from [`demo_dataset.sql`](file:///d:/projects/New%20folder/School%20Companion%20AI/demo_dataset.sql).

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19, Tailwind CSS, Motion, Lucide Icons, Sonner.
- **Backend / Router:** TanStack Start, Vite.
- **AI Gateway & SDK:** `@ai-sdk/google` (Google AI Studio Native SDK), `@ai-sdk/openai-compatible`.
- **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS).
- **Voice System:** Native Web Speech API & Google Gemini 3.1 Flash TTS.

## 📂 5. Repository Structure (School ERP Ecosystem)

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

## 🛡️ 6. Security & Safety Implementation

Security is enforced at the **application, database, and tool layers** rather than relying solely on LLM prompt instructions:

| Threat / Requirement                   | Application-Layer Enforcement Mechanism                                                                                                                                                                              |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Prompt Injection**                | System prompts bind the caller's role to the JWT token session (`actor.role`). Even if an attacker tricks the model, server-side tool functions throw a `ForbiddenError` at the code level (`school-api.server.ts`). |
| **2. Unauthorized Data Access**        | Database queries use Supabase Row Level Security (RLS). Students and Parents can only retrieve rows linked to their authenticated `studentId` or guardian email.                                                     |
| **3. System-Prompt Extraction**        | Tool schemas and prompt rules explicitly sanitize outputs and reject system prompt extraction attempts.                                                                                                              |
| **4. API Key / Credential Protection** | All API keys (`GEMINI_API_KEYS`, `LOVABLE_API_KEY`) reside exclusively in server-side handlers (`src/routes/api/*`). Keys are never sent to the browser or client bundle.                                            |
| **5. Fake Role Claims**                | Role identity is parsed directly from signed Supabase JWT headers (`Authorization: Bearer <jwt>`) via `getActor(request)`. Body or prompt role claims are ignored.                                                   |
| **6. Unauthorized Actions**            | Sensitive tools like `mark_attendance` and `get_school_analytics` are **dynamically omitted** from non-authorized roles at tool build time (`tools.server.ts`), and re-checked programmatically before DB updates.   |

---

## 📄 License

MIT License. Built for educational and administrative excellence.
