# ClearLens — AI-Powered Content Moderation Platform

A full-stack content moderation platform that screens user-submitted images against configurable policy categories using AI vision analysis, supports a structured appeal process, and gives administrators policy configuration and analytics tooling.

Built as a full-stack intern assessment submission.

## Tech Stack

- **Frontend:** React (Vite) + React Router
- **Backend:** Node.js + Express
- **Database:** MongoDB (single-node replica set, required for transaction support)
- **Authentication:** Clerk (`@clerk/express` on the backend, `@clerk/clerk-react` on the frontend)
- **AI Vision:** Google Gemini (`gemini-2.5-flash`) — used for per-category image classification
- **File Uploads:** Handled directly by the Express backend via Multer (local disk storage, Docker volume-backed)
- **Containerization:** Docker + Docker Compose

## Why Gemini Instead of a Paid Model

The AI integration originally targeted Claude's vision API, but Anthropic's API requires billing to be enabled even for light usage. Since this is an unpaid assessment project, the AI screening service was built against **Google Gemini's free tier** instead (no credit card required, generous rate limits for development use). The screening service is structured so the underlying model could be swapped with minimal changes — the prompt-building and JSON-parsing logic in `aiScreening.service.js` is model-agnostic in design, even though the current implementation calls Gemini's SDK directly.

## Architecture Decisions

### Policy Snapshotting (Non-Retroactive Policy Changes)

Every `Verdict` document stores a full embedded copy (`policySnapshot`) of the policy configuration that was active at the moment of screening — not a reference to the live `PolicyVersion` document. This is what guarantees that admin policy changes only affect future submissions, never past ones, even if the original policy is later edited or replaced.

### Policy Versioning (No In-Place Mutation)

When an admin updates policy settings, the backend never edits the existing `PolicyVersion` document. Instead, it deactivates the current version and creates a brand new one with an incremented version number. This preserves a complete, untouched audit history and is what makes the snapshot guarantee above actually hold up over time.

### Atomic Appeal Resolution

Accepting an appeal must update both the `Appeal` status and the related `Submission`/`Verdict` outcome together, with no possibility of one succeeding while the other fails. This is implemented using a real MongoDB transaction (`session.withTransaction`), which is why the database runs as a **single-node replica set** rather than a plain standalone instance — standalone MongoDB does not support multi-document transactions.

### Submission Outcome Precedence

A submission's `overallStatus` is derived from its constituent image verdicts using this precedence: any `Blocked` verdict makes the whole submission `Blocked`; otherwise, any `Flagged` verdict makes it `Flagged`; otherwise it's `Approved`. This is recomputed (never left stale) both at submission creation and after an appeal acceptance overrides a verdict.

### Sequential AI Screening

Multi-image submissions are screened **sequentially**, one image at a time, rather than in parallel. This is a deliberate choice to stay within Gemini's free-tier rate limits (10 requests/minute on the model used), at the cost of slower processing for large submissions.

### File Uploads via Backend, Not a Third-Party Service

Uploaded images are received directly by the Express backend (via Multer) and stored on disk inside a Docker-managed volume, rather than routed through a separate third-party storage service. This keeps the entire system self-contained within the Docker Compose setup with a single authentication system (Clerk) and avoids introducing an unrelated second account/auth requirement for end users.

### "Violation" Definition (Analytics)

The spec does not precisely define what counts as a "violation" for the ranked-users analytics endpoint. This implementation counts any submission with an outcome of `Flagged` or `Blocked` as a violation, not only `Blocked` ones.

## Project Structure

```
AI-Content-Moderation-Platform/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/db.js
│   │   ├── models/          # User, PolicyVersion, Submission, Verdict, Appeal
│   │   ├── middleware/      # auth, upload, error handling
│   │   ├── routes/          # submissions, appeals, policy, analytics, upload
│   │   ├── controllers/
│   │   ├── services/        # aiScreening.service.js, verdict.service.js
│   │   └── seedPolicy.js    # one-time policy seed utility, see Setup below
│   └── uploads/              # uploaded images (gitignored, Docker volume-backed)
└── frontend/
    ├── Dockerfile
    └── src/
        ├── pages/             # Home, SubmissionHistory, AppealTracker, admin/*
        ├── components/        # AdminRoute (role-based route guard)
        └── api/client.js      # authenticated fetch wrapper
```

## Setup Instructions

### Prerequisites

- Docker Desktop installed and running
- A free [Clerk](https://clerk.com) account and application (for `CLERK_SECRET_KEY` / publishable key)
- A free [Google AI Studio](https://aistudio.google.com) API key (for `GEMINI_API_KEY`) — no credit card required

### 1. Environment Variables

Copy `.env.example` to `.env` at the project root and fill in real values:

```
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
VITE_CLERK_PUBLISHABLE_KEY=
GEMINI_API_KEY=
```

`CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` should be the **same value** — Clerk's publishable key is meant to be shared between frontend and backend, only the secret key must stay private.

### 2. Run with Docker Compose

From the project root:

```bash
docker-compose up --build
```

This starts three containers: MongoDB (configured as a single-node replica set, required for transaction support), the backend API, and the frontend. The first run will take a few minutes while images build.

Once running:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5050/api`

### 3. First-Run Setup (Required — Fresh Database Seeding)

On a completely fresh database, two pieces of data must exist before the app is usable: a real signed-in user, and an active policy configuration. These cannot be created until at least one user exists, so the order matters:

1. Open `http://localhost:5173` and sign up / sign in with a real Clerk account. This triggers the backend's lazy-sync, creating a `User` document in MongoDB tied to your Clerk account.
2. Seed the initial policy configuration by running:
   ```bash
   docker exec -it clearlens-backend node src/seedPolicy.js
   ```
   This creates the first active `PolicyVersion` with all six moderation categories enabled at reasonable default thresholds.
3. To access admin-only pages (Policy Config, Appeals Queue, Analytics), set your Clerk account's `publicMetadata` to `{ "role": "admin" }` via the [Clerk Dashboard](https://dashboard.clerk.com) under your user's metadata, then sign out and back in (or refresh) for the role to take effect.

### Running Without Docker (Local Development)

Each service can also run independently for faster iteration during development:

**Backend:**

```bash
cd backend
npm install
# requires backend/.env with PORT, MONGO_URI, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, GEMINI_API_KEY
npm run dev
```

**Frontend:**

```bash
cd frontend
npm install
# requires frontend/.env.local with VITE_CLERK_PUBLISHABLE_KEY, VITE_API_BASE_URL
npm run dev
```

**MongoDB** (must be a replica set, not standalone, for transaction support):

```bash
docker run -d -p 27017:27017 --name clearlens-mongo mongo --replSet rs0
docker exec -it clearlens-mongo mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

## API Overview

All endpoints are prefixed with `/api` and return a consistent envelope: `{ success, data }` on success or `{ success: false, error: { code, message } }` on failure.

| Endpoint                  | Method | Access                   | Description                                              |
| ------------------------- | ------ | ------------------------ | -------------------------------------------------------- |
| `/upload`                 | POST   | User                     | Uploads image files, returns public URLs                 |
| `/submissions`            | POST   | User                     | Submits images for AI screening                          |
| `/submissions`            | GET    | User                     | Lists own submissions, with status/category/date filters |
| `/submissions/:id`        | GET    | User (own) / Admin (any) | Full submission detail with verdicts                     |
| `/appeals`                | POST   | User                     | Files an appeal against a Flagged/Blocked submission     |
| `/appeals/mine`           | GET    | User                     | Lists own filed appeals                                  |
| `/appeals/queue`          | GET    | Admin                    | Lists all pending appeals                                |
| `/appeals/:id/resolve`    | PATCH  | Admin                    | Accepts or rejects a pending appeal                      |
| `/policy/active`          | GET    | Admin                    | Returns the current active policy configuration          |
| `/policy`                 | PUT    | Admin                    | Creates a new policy version                             |
| `/policy/history`         | GET    | Admin                    | Lists all past policy versions                           |
| `/analytics/volume`       | GET    | Admin                    | Submission volume over time                              |
| `/analytics/verdicts`     | GET    | Admin                    | Verdict distribution by outcome and category             |
| `/analytics/appeals`      | GET    | Admin                    | Appeal volume and resolution rate                        |
| `/analytics/users/ranked` | GET    | Admin                    | Top users by submission count and violation count        |

## Known Limitations

- The free-tier Gemini API has rate limits (10 requests/minute); large multi-image submissions are screened sequentially to stay within these limits, which slows down processing time for big batches.
- Fresh database setup requires a manual one-time seed step (documented above) rather than fully automatic initialization.
- The appeals queue and submission list display raw user/submission IDs rather than resolved display names in some views; this could be improved with `.populate()` calls on the relevant queries.
