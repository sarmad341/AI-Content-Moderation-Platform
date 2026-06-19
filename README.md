# ClearLens — AI-Powered Content Moderation Platform

A full-stack content moderation system that screens user-submitted images against configurable AI-driven policy categories, supports a structured appeal workflow, and gives administrators full control over enforcement rules and platform analytics.

Built as a full-stack intern technical assessment.

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

**Note on AI provider:** The original design considered Anthropic's Claude API, but that requires a billing-enabled account with no free tier. Google's Gemini API was chosen instead because it offers a genuinely free tier with strong vision capabilities and no credit card requirement — appropriate for an unpaid assessment project. The AI screening logic lives in a single isolated service (`backend/src/services/aiScreening.service.js`), so swapping providers in the future only requires changing that one file.

---

## Architecture Overview

```
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
```

**Request flow for a submission:**

1. User selects images in the browser → React sends them via `multipart/form-data` to `POST /api/upload`.
2. The backend (Multer) stores the files on disk and returns public URLs.
3. The frontend sends those URLs to `POST /api/submissions`.
4. The backend fetches the currently active policy, then — for each image, **sequentially** — calls the Gemini screening service, applies threshold/enforcement logic, and stores a `Verdict` document (with an embedded snapshot of the policy that was active at that moment).
5. The submission's overall status is computed from its constituent verdicts and returned to the frontend.

---

## Setup Instructions

### Prerequisites

- Docker Desktop installed and running
- A free [Clerk](https://clerk.com) account (for authentication keys)
- A free [Google AI Studio](https://aistudio.google.com) API key (for Gemini)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd AI-Content-Moderation-Platform
```

### 2. Configure environment variables

Copy the example file and fill in your real values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) below for what each one is and where to get it.

### 3. Start everything with Docker Compose

```bash
docker-compose up --build
```

This builds and starts three containers: MongoDB (configured as a single-node replica set, required for transactional appeal resolution), the Express backend (port `5050`), and the React frontend (port `5173`).

The first build takes a few minutes (installing dependencies, building the frontend bundle). Wait until you see the backend log `MongoDB connected` and `Server running on port 5050`.

### 4. Sign in once, then seed the initial policy

**This step is required and cannot be automated away** — see [Known Limitations](#known-limitations) for why.

1. Open `http://localhost:5173` in your browser and sign up / sign in via Clerk. This creates your first `User` record in the database (via lazy-sync on your first authenticated request).
2. Run the policy seed script inside the running backend container:

```bash
docker exec -it clearlens-backend node src/seedPolicy.js
```

This creates an active `PolicyVersion` with all six moderation categories enabled, using sensible default thresholds. Without this step, image submissions will fail with a "no active policy" error.

### 5. (Optional) Make your account an admin

By default, every new sign-up is a regular `user`. To access the Appeals Queue, Policy Configuration, and Analytics pages, set your Clerk account's `publicMetadata` to `{ "role": "admin" }` from the [Clerk Dashboard](https://dashboard.clerk.com) → Users → (your user) → Metadata. Then sign out and back in (or refresh) for the change to take effect.

### 6. Use the app

Visit `http://localhost:5173`, submit images for screening, view your submission history, file appeals on Flagged/Blocked submissions, and (as an admin) manage policy, review appeals, and view analytics.

---

## Environment Variables

All variables live in a single root-level `.env` file, read by `docker-compose.yml`.

| Variable | Used by | Description | Where to get it |
|---|---|---|---|
| `CLERK_SECRET_KEY` | Backend | Verifies Clerk session tokens server-side | Clerk Dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Backend | Required by the Clerk Node/Express SDK alongside the secret key | Clerk Dashboard → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Same publishable key, exposed to the React app | Clerk Dashboard → API Keys (same value as above) |
| `GEMINI_API_KEY` | Backend | Authenticates calls to Google's Gemini vision API | [Google AI Studio](https://aistudio.google.com) → Get API Key |

`MONGO_URI` is **not** a configurable variable — `docker-compose.yml` hardcodes the correct internal Docker network address (`mongodb://mongo:27017/clearlens?replicaSet=rs0`), since it never needs to change between environments when running via Compose.

---

## Running Without Docker (Local Development)

For active development, running both processes natively (outside Docker) gives faster iteration:

**Backend** (`backend/.env`):
```
PORT=5050
MONGO_URI=mongodb://localhost:27017/clearlens?replicaSet=rs0
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
GEMINI_API_KEY=...
```

```bash
# Start a local replica-set-enabled MongoDB container
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

The same first-sign-in + seed-script step from the Docker instructions applies here too (run `node src/seedPolicy.js` from inside `backend/`, after signing in once via the frontend).

---

## Key Architecture Decisions

**Policy snapshotting (non-retroactive policy changes).** Every `Verdict` document stores a full embedded copy of the `PolicyVersion` that was active at the moment of screening — not a reference to it. When an admin updates policy, a brand-new `PolicyVersion` document is created and the old one is marked inactive; the old version's category settings are never edited in place. This guarantees that changing a threshold today can never silently alter the meaning of a verdict issued last week, satisfying the spec's explicit requirement that policy changes apply only to future submissions.

**Atomic appeal acceptance via MongoDB transactions.** Accepting an appeal must update the appeal's status *and* override the related submission's outcome together — if only one of those writes succeeded (e.g., a server crash mid-operation), the system would be left in an inconsistent state (an "Accepted" appeal pointing at a still-"Blocked" submission). This is handled with a real MongoDB transaction (`session.withTransaction`), which required configuring MongoDB as a single-node replica set, since standalone MongoDB instances don't support transactions.

**Separation of AI screening from business rules.** `aiScreening.service.js` only ever asks "what does the model see in this image," and returns raw classification/confidence/reasoning per category — it has no knowledge of thresholds or enforcement behavior. `verdict.service.js` takes those raw results and applies the actual business rules (threshold comparison, Auto-Block precedence over Flag for Review). This separation means the AI provider can be swapped, or the threshold logic can be unit-tested, without touching the other.

**Backend-hosted file uploads instead of a third-party storage service.** An earlier design considered using a client-side cloud storage SDK for image uploads, but that approach requires a separate user authentication flow unrelated to the app's existing Clerk-based auth — meaning users would be prompted to sign into a second, unrelated service just to submit an image. Instead, uploads are handled directly by the Express backend (via Multer) and stored on a Docker-managed volume, keeping the entire system under one coherent auth boundary and matching the spec's requirement that the REST API be the sole interface between frontend and backend state.

**Confidence score semantics.** Early testing surfaced a real bug: the AI model would sometimes report high "confidence" scores for an *absence* of a violation (i.e., confidently safe), which inverted the intended meaning of the threshold check and caused safe images to be wrongly Blocked. The prompt was rewritten with explicit anchoring (0 = clearly does not match the violation, 100 = clearly does) and a worked example, which corrected the behavior. This is documented here because it's a subtle, easy-to-miss class of bug specific to using LLMs for structured classification.

---

## API Overview

All endpoints are prefixed with `/api` and require a valid Clerk session token (`Authorization: Bearer <token>`) except `/health`.

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/upload` | User | Upload image files, returns public URLs |
| POST | `/submissions` | User | Submit image URLs for AI screening |
| GET | `/submissions` | User | List own submissions, with status/category/date filters |
| GET | `/submissions/:id` | User/Admin | Full submission detail with verdicts |
| POST | `/appeals` | User | File an appeal against a Flagged/Blocked submission |
| GET | `/appeals/mine` | User | Track own appeal statuses |
| GET | `/appeals/queue` | Admin | View all Pending appeals |
| PATCH | `/appeals/:id/resolve` | Admin | Accept or reject an appeal |
| GET | `/policy/active` | Admin | View current active policy |
| PUT | `/policy` | Admin | Update policy (creates a new version) |
| GET | `/policy/history` | Admin | View all past policy versions |
| GET | `/analytics/volume` | Admin | Submission volume over time |
| GET | `/analytics/verdicts` | Admin | Verdict distribution by outcome/category |
| GET | `/analytics/appeals` | Admin | Appeal volume and resolution rates |
| GET | `/analytics/users/ranked` | Admin | Top users by submission/violation count |

All responses follow a consistent envelope: `{ "success": true, "data": {...} }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.

---

## Known Limitations

In the interest of transparency, this section documents known gaps rather than hiding them:

- **Manual first-run setup step.** As described above, an admin must sign in once and run a seed script before the platform is usable. This could be automated with a Docker entrypoint script or a startup migration, but was left as a documented manual step given project time constraints.
- **No automated test suite.** All business logic (threshold/enforcement rules, transaction-based appeal resolution, policy versioning) was manually verified extensively during development via isolated test scripts, but no test suite is checked into the repository.
- **No dedicated "all Flagged submissions" admin queue.** Admins currently see Flagged/Blocked submissions through the Appeals Queue (once a user files an appeal) and through Analytics (in aggregate), but there isn't a standalone page listing every Flagged/Blocked submission regardless of whether an appeal was filed.
- **Clerk role and MongoDB role can drift.** A user's `role` is synced from Clerk's `publicMetadata` into MongoDB only at the moment of their first authenticated backend request (lazy-sync). If an admin changes a user's role in Clerk's dashboard afterward, the MongoDB-side role does not automatically update.
- **Category coverage gaps inherent to free-tier AI.** Gemini's vision model is prompted with the exact six category definitions from the spec, so coverage is broad, but as with any LLM-based classifier, edge cases and ambiguous imagery may occasionally be misclassified — this is mitigated, not eliminated, by the appeal workflow.
