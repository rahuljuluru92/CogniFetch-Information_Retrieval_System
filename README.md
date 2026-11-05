# CogniFetch

**Turn a photo of your syllabus into a curated study plan.** Upload an image, and CogniFetch reads the text (OCR),
extracts every topic with Gemini, then finds a focused YouTube video and a short Wikipedia explainer for each one.
Save subjects to your profile and come back to them any time.

### Features

- **Scan or paste**: upload up to 5 photos of a multi-page syllabus, or paste its text directly
- **Smart topic extraction** with Gemini, plus a rule-based fallback
- **Video picks**: the best match plus 2 alternatives, with an optional preferred channel or "most watched" filter
- **Wikipedia summary** next to every video
- **AI quiz**: "Quiz me" generates multiple-choice questions with explanations and a score
- **Progress tracking**: tick topics off and see a progress bar per subject, synced to your profile
- **Export** any list as a Markdown checklist
- **Account management**: change your password (signs out other devices) or delete your account and data

![Results page: topic checklist with progress, video player, alternative videos and Wikipedia summary](docs/screenshots/results.jpg)

| Home | Scan or paste a syllabus |
| --- | --- |
| ![Home page](docs/screenshots/home.jpg) | ![Scan page in paste-text mode](docs/screenshots/scan.jpg) |
| **AI quiz** | **Profile with progress per subject** |
| ![Quiz with answers, explanations and score](docs/screenshots/quiz.jpg) | ![Profile page with saved subjects and progress bars](docs/screenshots/profile.jpg) |

## Architecture

```
client/   React 19 + Vite + Tailwind 4 SPA
server/   Express 5 REST API + MongoDB (Mongoose)
            ├─ OCR.space      image → text
            ├─ Gemini         text → topics (falls back to a rule-based extractor)
            ├─ YouTube Data   topic → video
            └─ Wikipedia      topic → summary
```

In production a single container serves both the API (`/api/*`) and the built client, so the session cookie is
first-party and no CORS setup is needed. Split deployments (separate frontend host) are also supported.

### Production features

- **Auth**: bcrypt (12 rounds) password hashing, JWT in an `HttpOnly`/`SameSite` cookie, case-insensitive unique
  usernames, constant-time login responses, account deletion that removes all user data.
- **Hardening**: Helmet with a strict Content-Security-Policy, origin allowlist (also blocks cross-site requests),
  per-route rate limits (auth, OCR, video search), request size limits, upload type checks by magic bytes rather than
  the file name, Zod validation on every input, and log redaction for secrets and cookies.
- **Reliability**: validated config that fails fast, timeouts on every outbound call, graceful shutdown, a
  `/api/health` endpoint, in-memory caching of YouTube and Wikipedia lookups to save API quota, and a structured
  JSON error format.
- **Quality**: 80+ automated tests (unit, API, React components, and MongoDB integration tests in CI), ESLint, a
  GitHub Actions CI pipeline and a multi-stage Docker image that runs as a non-root user.

## Quick start

Requirements: Node.js 20.19+ (22 recommended) and MongoDB (local, Docker or Atlas).

```bash
git clone https://github.com/rahuljuluru92/CogniFetch-Information_Retrieval_System.git
cd CogniFetch-Information_Retrieval_System
npm install
cp server/.env.example server/.env   # then fill in the values
npm run dev                          # API on :3500, web app on http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so everything runs on one origin locally.

### API keys

| Variable | Needed for | Get one |
| --- | --- | --- |
| `OCR_API_KEY` | Reading images (required) | <https://ocr.space/ocrapi> |
| `YOUTUBE_API_KEY` | Video search (required) | Google Cloud Console → enable **YouTube Data API v3** |
| `GEMINI_API_KEY` | Smarter topic extraction and quizzes (optional; quizzes are off without it) | <https://aistudio.google.com/app/apikey> |
| `JWT_SECRET` | Signing sessions (required, 32+ chars) | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

See [`server/.env.example`](server/.env.example) for every option.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (auto-reload) and client together |
| `npm test` | All server and client tests |
| `npm run lint` | ESLint for both workspaces |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API (set `SERVE_CLIENT=true` to also serve `client/dist`) |

Database integration tests run when `MONGODB_TEST_URI` is set (CI starts a MongoDB service for them):

```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/cognifetch-test npm test --workspace server
```

## Deployment

### Docker (recommended)

```bash
docker compose up --build
```

This starts the app and MongoDB at <http://localhost:3500> using `server/.env` for secrets. For a hosted deployment
(Render, Railway, Fly.io, ECS…), build the `Dockerfile` and set at least `MONGODB_URI`, `JWT_SECRET`,
`OCR_API_KEY`, `YOUTUBE_API_KEY` and, behind a load balancer, `TRUST_PROXY=1`. Serve it over HTTPS.

### Separate frontend host

Build the client with `VITE_API_URL=https://your-api.example.com`, and set the following on the API:
`CORS_ORIGINS=https://your-frontend.example.com`, `COOKIE_SAMESITE=none` (this makes the cookie `Secure`) and
`SERVE_CLIENT=false`.

## API

All endpoints are under `/api`. Errors use the shape `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | – | Liveness and database status |
| POST | `/auth/register` | – | `{ username, email, password }` → creates an account and starts a session |
| POST | `/auth/login` | – | `{ email, password }` → starts a session |
| POST | `/auth/logout` | – | Ends the session |
| GET | `/auth/me` | ✓ | Current user |
| DELETE | `/auth/me` | ✓ | `{ password }` → deletes the account and all its data |
| PATCH | `/auth/password` | ✓ | `{ currentPassword, newPassword }` → changes the password and signs out other sessions |
| POST | `/extract` | ✓ | multipart `images` (1–5 JPEG/PNG/WebP pages) → `{ concepts: string[], source }` |
| POST | `/extract/text` | ✓ | `{ text }` → `{ concepts: string[], source }` (no OCR) |
| POST | `/videos/search` | ✓ | `{ concept, subject?, channel?, popular? }` → `{ videos[], video, article }` |
| POST | `/quiz` | ✓ | `{ concept, subject?, count? (3–10) }` → `{ questions: [{ question, options[4], answerIndex, explanation }] }` (requires Gemini) |
| GET | `/history` | ✓ | Saved subjects (with `completed` progress) |
| PUT | `/history` | ✓ | `{ subject, concepts[], completed[]? }` → saves or replaces the subject |
| PATCH | `/history/:id/progress` | ✓ | `{ concept, done }` → marks one topic as done or not done |
| DELETE | `/history/:id` | ✓ | Removes a saved subject |

## Security

Never commit `.env` files; they are git-ignored. If a secret was ever pushed, **rotate it**: deleting it in a new
commit does not remove it from git history.

## Roadmap

- Topic recommendations based on frequent searches
- Merging videos into playlists to cut playback time
- Spaced-repetition reminders for quiz topics you got wrong

## Authors

- **Rahul Juluru**: [@rahuljuluru92](https://github.com/rahuljuluru92)
- **Kamal Poshala**: [@Kamal-Poshala](https://github.com/Kamal-Poshala)
