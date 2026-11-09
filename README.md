# SportTracker Web

Angular frontend for **SportTracker**, a table tennis tournament platform: tournaments, teams, fixtures, live scoring, standings and leaderboards. Mobile-first, with a sidebar layout on desktop and a bottom bar on phones.

The backend is the .NET 10 API in `SportTracker` (Clean Architecture). Everything here talks to its real endpoints; where the API has no endpoint yet, the gap is documented in [docs/backend-analysis.md](docs/backend-analysis.md) rather than faked.

## Quick start

Prerequisites: Node 22+ (developed on 24), npm 11, and the SportTracker API running locally.

```bash
npm install
npm start            # http://localhost:4200 (proxies /api to https://localhost:7248)
```

Start the API from the backend repo (`dotnet run --project SportTracker.Api --launch-profile https`). The dev server proxies `/api` to it (`proxy.conf.json`) because the API has no CORS policy.

### Accounts and sign-in

Reading is public. Everything that writes needs an account: open **Sign in**, enter your email, then the 6-digit code the API emails you. A new email creates your account (you also give a name). There are no passwords.

- Any signed-in user can create a tournament and becomes its **organizer**. Only the organizer (or a site admin) can register teams, configure, start, create matches, score and complete it; the API answers 403 `Tournament.Forbidden` to anyone else.
- Every account is also a **player**: organizers build teams from the people who have signed up (`GET /api/players?search=`). Edit your own name on **My profile**.
- The access token is kept in the browser's `localStorage` and attached to API requests only.

For local development run the API in Development with `Auth:Otp:FixedCode` set (for example `123456`) and `Auth:Jwt:SigningKey` configured. The code is then accepted without email, and honoured only in Development. See the backend repo's `AGENTS.md` ("Sign-in (email OTP)"); the limits and flow are summarised in [docs/architecture.md](docs/architecture.md#4-identity-and-authorization).

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Dev server with API proxy |
| `npm run build` | Production build into `dist/` |
| `npx ng build --configuration development` | Development build (uses `environment.development.ts`) |
| `npm test` | Unit tests (Vitest through the Angular builder) |
| `npx ng test --watch=false --include "src/app/features/matches/**/*.spec.ts"` | Run a subset |

## Configuration

`src/environments/environment.ts` (production) and `environment.development.ts` hold `apiBaseUrl`. It defaults to the relative `/api`, which works with the dev proxy and with any host that serves the app and the API from the same origin (for example behind Azure Front Door / an App Service reverse proxy). To point a deployment at a different API origin, change `apiBaseUrl` and add a CORS policy to the API. The URL is read in exactly one place (`core/config/api.config.ts`).

## Architecture

```
src/app/
  core/       models (backend DTOs, enums, ApiError), services (api/, auth, toast, confirm,
              tournament-directory), interceptors (auth, error), guards, state/AsyncState
  shared/     reusable UI: icon, status badge, page header, empty/error/skeleton states, stat tile,
              avatar, tab nav, match card, toast host, confirm dialog
  layout/     main layout, sidebar (desktop), header, mobile bottom navigation
  features/   dashboard, tournaments, matches, scoring, teams, players, statistics, standings, auth
```

- Standalone components, `OnPush`, signals for state, RxJS for HTTP. Components never call `HttpClient`; they use the typed services in `core/services/api`.
- **Wire-format normalisation** lives in `core/services/api/mappers.ts`: the API serialises enums as numbers but some DTOs carry them as strings, and several endpoints wrap results in a `Result<T>` envelope. Components only ever see string-union enums and bare values.
- **Errors**: the error interceptor converts ProblemDetails into `ApiError` (with the backend `code`); pages show `st-error-state` for failed loads and toasts for failed actions.
- **Auth**: JWT in `localStorage`. `AuthService.canManage(organizerUserId)` decides which actions to offer (the tournament's organizer or a site admin); the API enforces it on every request.
- Features are lazy-loaded (`app.routes.ts`). Route params bind to component inputs.
- Styling is a token-based SCSS design system in `src/styles.scss` (light and dark via `prefers-color-scheme`). No UI framework: dialogs use native `<dialog>`, icons are inline SVG.

## Documentation

Start at the [docs index](docs/README.md), which has a reading path for developers, solution architects and system-design learners.

| Document | Purpose |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions, how to add a page or API call, testing, definition of done |
| [docs/architecture.md](docs/architecture.md) | Context, structure, data flow, sign-in and scoring sequences, deployment, security, risks, glossary |
| [docs/backend-analysis.md](docs/backend-analysis.md) | API surface, contract quirks, gap register, verification status |
| [docs/design-decisions.md](docs/design-decisions.md) | What was built, the alternatives considered and the trade-offs |

## Backend gaps

The API now offers email one-time-code sign-in, per-tournament ownership, the tournament list (with `mine`), the player pool (registered users), `scheduledAt` and `scoringRuleId`, and the frontend uses them. Still missing: a CORS policy, tournament edit/delete, rescheduling, and point-by-point scoring and serve tracking. Full list: [docs/backend-analysis.md](docs/backend-analysis.md).

## Testing

- Unit tests for core logic (enum/wire mapping, `ApiError`, auth/JWT handling, API request/response contracts through `HttpTestingController`) and for each feature's pure logic (scoring session, derivations, filters).
- Current baseline: 22 spec files, 164 tests passing.
- End-to-end tests (`e2e/`, Playwright) are written but **have not been run yet** (`@playwright/test` is not installed). One-time setup, then run with the API up:

  ```bash
  npm install -D @playwright/test
  npx playwright install chromium
  export E2E_FIXED_CODE=123456   # the API's Auth:Otp:FixedCode (Development only)
  npx playwright test          # starts `npm start` if it is not already running
  ```

  The signed-in specs register real accounts (example.test emails) and create tournaments in the database the API uses (LocalDB `SportTrackerDb` in development). The guest specs only read.
- Still to do: a first manual run against the live API. See "Verification status" in `docs/backend-analysis.md`.
