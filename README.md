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

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Auth | Clerk (`@clerk/express`, `@clerk/clerk-react`) |
| Backend | Node.js + Express |
| Database | MongoDB (single-node replica set, for transaction support) |
| AI Screening | Google Gemini (`gemini-2.5-flash`, vision) |
| File Uploads | Multer (local disk storage, served by the backend) |
| Containerization | Docker + Docker Compose |

**Note on AI provider:** The original design considered Anthropic's Claude API, but that requires a billing-enabled account with no free tier. Google's Gemini API was chosen instead because it offers a genuinely free tier with strong vision capabilities and no credit card requirement. The AI screening logic lives in a single isolated service (`backend/src/services/aiScreening.service.js`), so swapping providers in the future only requires changing that one file.

---

## Architecture Overview
clearlens/

├── docker-compose.yml

├── .env.example

├── backend/

│   ├── Dockerfile

│   ├── src/

│   │   ├── app.js                  # Express app setup, route mounting

│   │   ├── server.js               # Entry point, DB connection, listen

│   │   ├── config/db.js            # MongoDB connection logic

│   │   ├── models/                 # User, Submission, Verdict, Appeal, PolicyVersion

│   │   ├── middleware/              # Clerk auth, lazy user-sync, file upload, error handling

│   │   ├── services/

│   │   │   ├── aiScreening.service.js   # Gemini vision integration

│   │   │   └── verdict.service.js       # Threshold/enforcement business logic

│   │   ├── controllers/             # submissions, appeals, policy, analytics

│   │   ├── routes/                  # REST route definitions

│   │   └── seedPolicy.js            # One-time setup script (see below)

│   └── uploads/                     # Locally stored submitted images (Docker volume)

└── frontend/

├── Dockerfile

└── src/

├── api/client.js            # Authenticated fetch wrapper

├── components/AdminRoute.jsx

└── pages/                   # Home, SubmissionHistory, AppealTracker, admin/*

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

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the real values — see [Environment Variables](#environment-variables) below.

### 3. Start everything with Docker Compose

```bash
docker-compose up --build
```

Starts MongoDB (single-node replica set), the backend (port `5050`), and the frontend (port `5173`). Wait for `MongoDB connected` and `Server running on port 5050` in the logs.

### 4. Sign in once, then seed the initial policy

1. Open `http://localhost:5173` and sign up / sign in via Clerk.
2. Run:

```bash
docker exec -it clearlens-backend node src/seedPolicy.js
```

This creates the active policy with all six categories enabled. Without it, submissions will fail.

### 5. Make your account an admin

By default, every sign-up is a regular `user`. To unlock the Appeals Queue, Flagged Submissions, Policy Configuration, and Analytics pages, go to the [Clerk Dashboard](https://dashboard.clerk.com) → Users → your account → Metadata, and set `publicMetadata` to:

```json
{ "role": "admin" }
```

Sign out and back in (or refresh) for the change to apply.

### 6. Use the app

Visit `http://localhost:5173` and explore: submit images, view history, file appeals, and (as admin) manage policy, review appeals, and view analytics.

---

## Environment Variables

| Variable | Used by | Description | Where to get it |
|---|---|---|---|
| `CLERK_SECRET_KEY` | Backend | Verifies Clerk session tokens server-side | Clerk Dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Backend | Required by the Clerk Express SDK | Clerk Dashboard → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Same publishable key, exposed to React | Same as above |
| `GEMINI_API_KEY` | Backend | Authenticates Gemini vision API calls | Google AI Studio → Get API Key |

`MONGO_URI` is hardcoded in `docker-compose.yml` and not configurable — it never changes between environments.

---

## Running Without Docker (Local Development)

**Backend** (`backend/.env`):
PORT=5050

MONGO_URI=mongodb://localhost:27017/clearlens?replicaSet=rs0

CLERK_SECRET_KEY=...

CLERK_PUBLISHABLE_KEY=...

GEMINI_API_KEY=...

```bash
docker run -d -p 27017:27017 --name clearlens-mongo mongo --replSet rs0
docker exec -it clearlens-mongo mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"

cd backend
npm install
npm run dev
```

**Frontend** (`frontend/.env.local`):
VITE_CLERK_PUBLISHABLE_KEY=...

VITE_API_BASE_URL=http://localhost:5050/api

```bash
cd frontend
npm install
npm run dev
```

Same sign-in-once-then-seed step applies here too.

---

## Key Architecture Decisions

**Policy snapshotting.** Every `Verdict` stores a full embedded copy of the `PolicyVersion` active at screening time — not a reference. Policy edits create a new version rather than mutating the old one, so historical verdicts are never retroactively altered.

**Atomic appeal acceptance.** Accepting an appeal updates the appeal's status and overrides the submission's outcome together, inside a real MongoDB transaction — required converting MongoDB to a single-node replica set, since standalone instances don't support transactions.

**AI screening vs. business rules, separated.** `aiScreening.service.js` only classifies what's in the image; `verdict.service.js` applies threshold and enforcement logic. This means the AI provider can be swapped without touching business rules, and vice versa.

**Backend-hosted uploads.** Images are uploaded directly to the Express backend (via Multer) and stored on a Docker volume, rather than a third-party storage SDK — keeping the whole system under one Clerk-based auth boundary instead of requiring a second, unrelated login.

**Confidence score semantics.** Early testing surfaced a bug where the AI reported high "confidence" for the *absence* of a violation, inverting the threshold check and wrongly Blocking safe images. The prompt was rewritten with explicit anchoring (0 = clearly safe, 100 = clearly violates) to fix this.

---

## API Overview

All endpoints are prefixed with `/api` and require a Clerk session token (`Authorization: Bearer <token>`) except `/health`.

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/upload` | User | Upload image files, returns public URLs |
| POST | `/submissions` | User | Submit image URLs for AI screening |
| GET | `/submissions` | User | List own submissions, with filters |
| GET | `/submissions/:id` | User/Admin | Full submission detail with verdicts |
| GET | `/submissions/admin/flagged` | Admin | All Flagged/Blocked submissions platform-wide |
| POST | `/appeals` | User | File an appeal |
| GET | `/appeals/mine` | User | Track own appeals |
| GET | `/appeals/queue` | Admin | Pending appeals queue |
| PATCH | `/appeals/:id/resolve` | Admin | Accept or reject an appeal |
| GET | `/policy/active` | Admin | Current active policy |
| PUT | `/policy` | Admin | Update policy (creates new version) |
| GET | `/policy/history` | Admin | All past policy versions |
| GET | `/analytics/volume` | Admin | Submission volume over time |
| GET | `/analytics/verdicts` | Admin | Verdict distribution |
| GET | `/analytics/appeals` | Admin | Appeal stats |
| GET | `/analytics/users/ranked` | Admin | Top users ranked |

Responses follow: `{ "success": true, "data": {...} }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.

---

## Known Limitations

- **Manual first-run setup.** An admin must sign in once and run a seed script before the platform is usable.
- **No automated test suite.** Business logic was manually verified extensively during development, but no checked-in tests exist.
- **Clerk role and MongoDB role can drift.** Role syncs from Clerk to MongoDB only at first login; later Clerk role changes don't auto-propagate.
- **Category coverage gaps inherent to free-tier AI.** As with any LLM-based classifier, edge cases may occasionally be misclassified — mitigated, not eliminated, by the appeal workflow.