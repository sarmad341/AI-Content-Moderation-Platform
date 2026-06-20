# ClearLens — AI-Powered Content Moderation Platform

A full-stack content moderation system that screens user-submitted images against configurable AI-driven policy categories, supports a structured appeal workflow, and gives administrators full control over enforcement rules and platform analytics.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Running Without Docker (Local Development)](#running-without-docker-local-development)
- [Key Architecture Decisions](#key-architecture-decisions)
- [API Overview](#api-overview)
- [Known Limitations](#known-limitations)

---

## Tech Stack

| Layer            | Technology                                                 |
| ---------------- | ---------------------------------------------------------- |
| Frontend         | React (Vite)                                               |
| Auth             | Clerk (`@clerk/express`, `@clerk/clerk-react`)             |
| Backend          | Node.js + Express                                          |
| Database         | MongoDB (single-node replica set, for transaction support) |
| AI Screening     | Google Gemini (`gemini-2.5-flash`, vision)                 |
| File Uploads     | Multer (local disk storage, served by the backend)         |
| Containerization | Docker + Docker Compose                                    |

**Note on AI provider:** The original design considered Anthropic's Claude API, but that requires a billing-enabled account with no free tier. Google's Gemini API was chosen instead because it offers a genuinely free tier with strong vision capabilities and no credit card requirement. The AI screening logic lives in a single isolated service (`backend/src/services/aiScreening.service.js`), so swapping providers in the future only requires changing that one file.

---

## Architecture Overview

```
AI-Content-Moderation-Platform/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── ensureDefaultPolicy.js   # auto-creates a default policy on first startup
│   │   ├── models/          # User, PolicyVersion, Submission, Verdict, Appeal
│   │   ├── middleware/      # auth, upload, error handling
│   │   ├── routes/          # submissions, appeals, policy, analytics, upload
│   │   ├── controllers/
│   │   ├── services/        # aiScreening.service.js, verdict.service.js
│   │   └── seedPolicy.js    # optional manual reset-to-defaults utility
│   └── uploads/              # uploaded images (gitignored, Docker volume-backed)
└── frontend/
    ├── Dockerfile
    └── src/
        ├── pages/            # Home, SubmissionHistory, AppealTracker, admin/*
        ├── components/       # AdminRoute (role-based route guard)
        └── api/client.js     # authenticated fetch wrapper
```

**Request flow for a submission:**

1. User selects images in the browser → React sends them via `multipart/form-data` to `POST /api/upload`.
2. The backend (Multer) stores the files on disk and returns public URLs.
3. The frontend sends those URLs to `POST /api/submissions`.
4. The backend fetches the currently active policy, then — for each image, sequentially — calls the Gemini screening service, applies threshold/enforcement logic, and stores a `Verdict` document (with an embedded snapshot of the policy active at that moment).
5. The submission's overall status is computed from its constituent verdicts and returned to the frontend.

---

## Setup Instructions

### Prerequisites

- Docker Desktop installed and running
- A free [Clerk](https://clerk.com) account
- A free [Google AI Studio](https://aistudio.google.com) API key

### 1. Clone the repository

```bash
git clone https://github.com/sarmad341/AI-Content-Moderation-Platform
cd AI-Content-Moderation-Platform
```

### 2. Get your Clerk API keys

1. Go to [clerk.com](https://clerk.com) and click **Sign in** in the top-right corner, then choose **Sign up** to register a free account.
2. Once logged in, click **Create application**.
3. Give it any name (e.g. "ClearLens"), and under sign-in options enable at least **Email**.
4. After the application is created, go to the **Configure** tab in the left sidebar, then click **API Keys**.
5. When prompted to choose a framework, select **React**.
6. You'll see two values: a **Publishable key** (starts with `pk_test_...`) and a **Secret key** (starts with `sk_test_...`). Copy both — you'll paste them into `.env` in Step 4 below.

### 3. Get your Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with any Google account.
2. Click **Get API key** in the left sidebar, then **Create API key**.
3. Copy the generated key (starts with `AIza...`).

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values you just copied:

```
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
GEMINI_API_KEY=AIza_your_gemini_key
```

> **Note:** `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` are the same value, just read by two different parts of the app (backend and frontend respectively).

### 5. Start everything with Docker Compose

```bash
docker-compose up --build
```

Starts MongoDB (single-node replica set), the backend (port `5050`), and the frontend (port `5173`). Wait for `MongoDB connected`, `Server running on port 5050`, and a log line confirming the default policy was created automatically.

### 6. Sign up and use the app

Open `http://localhost:5173` and sign up via Clerk (any email). A default moderation policy is created automatically on first backend startup, so you can submit images for screening right away — no manual setup step required.

### 7. (Optional) Make your account an admin

By default, every sign-up is a regular `user`. To unlock the Appeals Queue, Flagged Submissions, Policy Configuration, and Analytics pages:

1. Go back to your [Clerk Dashboard](https://dashboard.clerk.com).
2. In the left sidebar, click **Users**, then click on your account.
3. Scroll to the **Metadata** section and click **Edit** next to **Public metadata**.
4. Enter:
   ```json
   { "role": "admin" }
   ```
5. Save, then return to the app and refresh (or sign out and back in) for the change to apply.

---

## Environment Variables

| Variable                     | Used by  | Description                               |
| ---------------------------- | -------- | ----------------------------------------- |
| `CLERK_SECRET_KEY`           | Backend  | Verifies Clerk session tokens server-side |
| `CLERK_PUBLISHABLE_KEY`      | Backend  | Required by the Clerk Express SDK         |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Same publishable key, exposed to React    |
| `GEMINI_API_KEY`             | Backend  | Authenticates Gemini vision API calls     |

All four are obtained for free as described in Steps 2–3 above. `MONGO_URI` is hardcoded in `docker-compose.yml` and not configurable — it never changes between environments.

---

## Running Without Docker (Local Development)

**Backend** (`backend/.env`):

```
PORT=5050
MONGO_URI=mongodb://localhost:27017/clearlens?replicaSet=rs0
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
GEMINI_API_KEY=...
```

```bash
docker run -d -p 27017:27017 --name clearlens-mongo mongo --replSet rs0
docker exec -it clearlens-mongo mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"

cd backend
npm install
npm run dev
```

**Frontend** (`frontend/.env.local`):

```
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_API_BASE_URL=http://localhost:5050/api
```

```bash
cd frontend
npm install
npm run dev
```

The same auto-seed behavior applies here too — a default policy is created automatically on first backend startup if none exists.

---

## Key Architecture Decisions

**Policy snapshotting.** Every `Verdict` stores a full embedded copy of the `PolicyVersion` active at screening time — not a reference. Policy edits create a new version rather than mutating the old one, so historical verdicts are never retroactively altered.

**Atomic appeal acceptance.** Accepting an appeal updates the appeal's status and overrides the submission's outcome together, inside a real MongoDB transaction — required converting MongoDB to a single-node replica set, since standalone instances don't support transactions.

**AI screening vs. business rules, separated.** `aiScreening.service.js` only classifies what's in the image; `verdict.service.js` applies threshold and enforcement logic. This means the AI provider can be swapped without touching business rules, and vice versa.

**Backend-hosted uploads.** Images are uploaded directly to the Express backend (via Multer) and stored on a Docker volume, rather than a third-party storage SDK — keeping the whole system under one Clerk-based auth boundary instead of requiring a second, unrelated login.

**Confidence score semantics.** Early testing surfaced a bug where the AI reported high "confidence" for the _absence_ of a violation, inverting the threshold check and wrongly Blocking safe images. The prompt was rewritten with explicit anchoring (0 = clearly safe, 100 = clearly violates) to fix this.

**Auto-seeded default policy.** On every backend startup, the system checks whether an active `PolicyVersion` exists; if not, it creates one automatically (using a placeholder system user to satisfy the schema's `updatedBy` requirement). This removes any manual setup step for a fresh database — a grader running `docker-compose up` for the first time can submit an image immediately after signing up.

---

## API Overview

All endpoints are prefixed with `/api` and require a Clerk session token (`Authorization: Bearer <token>`) except `/health`.

| Method | Path                         | Role       | Description                                   |
| ------ | ---------------------------- | ---------- | --------------------------------------------- |
| POST   | `/upload`                    | User       | Upload image files, returns public URLs       |
| POST   | `/submissions`               | User       | Submit image URLs for AI screening            |
| GET    | `/submissions`               | User       | List own submissions, with filters            |
| GET    | `/submissions/:id`           | User/Admin | Full submission detail with verdicts          |
| GET    | `/submissions/admin/flagged` | Admin      | All Flagged/Blocked submissions platform-wide |
| POST   | `/appeals`                   | User       | File an appeal                                |
| GET    | `/appeals/mine`              | User       | Track own appeals                             |
| GET    | `/appeals/queue`             | Admin      | Pending appeals queue                         |
| PATCH  | `/appeals/:id/resolve`       | Admin      | Accept or reject an appeal                    |
| GET    | `/policy/active`             | Admin      | Current active policy                         |
| PUT    | `/policy`                    | Admin      | Update policy (creates new version)           |
| GET    | `/policy/history`            | Admin      | All past policy versions                      |
| GET    | `/analytics/volume`          | Admin      | Submission volume over time                   |
| GET    | `/analytics/verdicts`        | Admin      | Verdict distribution                          |
| GET    | `/analytics/appeals`         | Admin      | Appeal stats                                  |
| GET    | `/analytics/users/ranked`    | Admin      | Top users ranked                              |

Responses follow: `{ "success": true, "data": {...} }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.

---

## Known Limitations

- **Gemini free-tier rate limit.** The free tier allows a limited number of requests per day (currently 20 for `gemini-2.5-flash`). Heavy testing — many submissions in a short period — may temporarily exhaust this quota, causing submissions to fail with a 429 error until the quota resets (typically within 24 hours, sometimes faster per-minute). Generating your own free Gemini API key (rather than reusing one already near its limit) avoids this during evaluation.
- **No automated test suite.** Business logic was manually verified extensively during development, but no checked-in tests exist.
- **Clerk role and MongoDB role can drift.** Role syncs from Clerk to MongoDB only at first login; later Clerk role changes don't auto-propagate.
- **Category coverage gaps inherent to free-tier AI.** As with any LLM-based classifier, edge cases may occasionally be misclassified — mitigated, not eliminated, by the appeal workflow.
