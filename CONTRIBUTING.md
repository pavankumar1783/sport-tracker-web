# Contributing to SportTracker Web

How to work on this codebase. Setup and commands are in the [README](README.md); the structure and rules behind it are in [docs/architecture.md](docs/architecture.md).

## Ground rules

1. **The backend owns business rules.** The UI decides what to *offer*; the API decides what is *allowed*. Show the API's error message, do not re-implement the check. Where the UI mirrors a rule (scoring), it is a hint, never the gate.
2. **No mock data when a real endpoint exists.** If the API cannot do something, leave the feature out, say so in the UI, and add a row to the gap table in [docs/backend-analysis.md](docs/backend-analysis.md).
3. **Components never call `HttpClient`.** Use the typed clients in `src/app/core/services/api`.
4. **Wire quirks stay at the edge.** Number-vs-string enums, `Result<T>` envelopes and timestamps without `Z` are handled in `core/services/api/mappers.ts`. Components only see string unions and plain values.
5. **Dependency direction:** `features` -> `core`, `shared`, `layout`. `core` and `shared` never import from `features`. Features do not import each other's pages.
6. **Prefer the platform** (native `<dialog>`, native date inputs, CSS variables) over adding a dependency. Adding a runtime dependency needs a reason in the PR.

## Conventions

| Topic | Convention |
|---|---|
| Components | Standalone, `ChangeDetectionStrategy.OnPush`, selector prefix `st-`, inline template for small ones |
| State | Signals. `AsyncState<T>` for one HTTP-backed value. RxJS only for HTTP and cancellation |
| Route params | Bound to component `input()`s (`withComponentInputBinding`); child routes inherit parent params |
| Files | `*.page.ts` routed pages, `*.component.ts` reusable UI, `*.api.ts` HTTP clients, `*.logic.ts` or `*-logic.ts` pure rules, `*.routes.ts` per-feature lazy routes |
| Styles | Global tokens and shared classes (`.card`, `.btn`, `.field`, `.badge`, `.table`, `.grid`) in `src/styles.scss`; components add layout-only styles. Support light and dark |
| Formatting | Prettier (`.prettierrc`: 100 columns, single quotes), `.editorconfig` |
| Errors | Let the interceptor produce `ApiError`. Failed load: `st-error-state` with Retry. Failed action: toast with the backend message |
| Comments | Only for a non-obvious why (a constraint, workaround, invariant) |

## Recipes

### Add a page to an existing feature

1. Create `features/<feature>/pages/<name>.page.ts` (standalone, `OnPush`).
2. Register it in `features/<feature>/<feature>.routes.ts` with `title` and `loadComponent`. Add `canActivate: [authGuard]` only if it needs a signed-in user.
3. Load data with `new AsyncState<T>()` and `state.load(api.method(...))`. Render `loading`, `error` (with Retry) and `data`.
4. Gate write actions with `TournamentContext.canManage()` (inside a tournament) or `AuthService.canManage(organizerUserId)`.

### Add a new feature area

1. Create `features/<name>/` with `<name>.routes.ts`.
2. Add a lazy `loadChildren` entry in `src/app/app.routes.ts` and update the route-map comment there.
3. If it needs a nav entry, add it to `layout/nav-items.ts` (the first four appear in the phone bottom bar, the rest under More).
4. Update the route table in [docs/architecture.md](docs/architecture.md).

### Add or change an API call

1. Add or adjust the request/result types in `core/models/api.models.ts`.
2. If the wire shape differs from the model (numeric enum, envelope, optional field), add a mapper in `core/services/api/mappers.ts`. Wrapped results go through `unwrap()`.
3. Add the method to the relevant `core/services/api/*.api.ts`, with a doc comment `/** METHOD /api/path */` naming the endpoint and any quirk.
4. Add a contract test next to `api-integration.spec.ts` or `pools-api.spec.ts` using `HttpTestingController`, flushing a payload **copied from the backend record**, not invented.
5. If the call fixes or reveals a backend gap, update [docs/backend-analysis.md](docs/backend-analysis.md).

### Add a permission-dependent action

1. Decide the rule in the API first (who may call it).
2. In the UI, offer the action only when `canManage` is true and the tournament status allows it (rules live in `features/tournaments/tournament-logic.ts`).
3. Handle the 403/401 anyway: toast the `ApiError.userMessage`.

### Switch the API address

Edit `apiBaseUrl` in `src/environments/environment*.ts`. If the API is on a different origin than the app, the API needs a CORS policy first. See "Deployment" in [docs/architecture.md](docs/architecture.md).

## Testing

| Layer | What | How |
|---|---|---|
| Pure logic | scoring session, lifecycle rules, filters, derivations, mappers | Plain Vitest specs next to the file (`*.spec.ts`). Heaviest coverage goes here |
| API contract | request URL, body and response normalisation | `HttpTestingController` with real-shaped payloads |
| Pages | main interactions of sign-in, tournament pages, match detail | `TestBed` component tests |
| End to end | sign-in, ownership, guest browsing, responsive layout | Playwright in `e2e/` (see below) |

```bash
npm test                                   # all unit tests, watch mode in a terminal
npx ng test --watch=false                  # single run (CI)
npx ng test --watch=false --include "src/app/features/matches/**/*.spec.ts"
```

Current baseline: 22 spec files, 164 tests, all passing.

### End to end

Playwright specs exist (`e2e/guest.spec.ts`, `e2e/signed-in.spec.ts`) but **the Playwright package is not installed and the specs have never been run**. To run them:

```bash
npm install -D @playwright/test
npx playwright install chromium
export E2E_FIXED_CODE=123456        # must equal the API's Auth:Otp:FixedCode (Development only)
npx playwright test                 # projects: desktop and phone (Pixel 7)
```

The signed-in specs create real accounts (`example.test` emails) and tournaments in the API's database. Run them only against a development database. Without `E2E_FIXED_CODE` they are skipped and only the read-only guest specs run.

## Definition of done

- [ ] `npx ng test --watch=false` passes; new logic has tests
- [ ] `npm run build` succeeds with no warnings
- [ ] Feature checked in a browser against the running API: happy path, an error path, signed-out and non-owner behaviour
- [ ] Layout checked at phone width (about 360 px) and desktop, light and dark
- [ ] No new `HttpClient` use in components; no mock data
- [ ] Docs updated if you changed routes, the API surface, a gap, or an architectural decision

## Pull requests

- Keep a PR to one concern. Describe what changed and why; link the gap (G-number) if relevant.
- Include screenshots for UI changes (phone and desktop).
- The repository currently has a single commit and no CI pipeline. Until a pipeline exists, paste the output of the test and build commands into the PR.

## Working with the backend repo

The backend lives in the `SportTracker` repository (.NET 10). When this app needs something it lacks, record it in [docs/backend-analysis.md](docs/backend-analysis.md) with the endpoint wanted and the current workaround, and keep a single owner of that file to avoid duplicate gap numbers. The backend's own `AGENTS.md` documents its sign-in (email OTP) setup, including `Auth:Otp:FixedCode` for local development.
