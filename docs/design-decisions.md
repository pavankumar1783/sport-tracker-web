# SportTracker Web: what we built and why

A learning log of the work done on the frontend: the order we worked in, each real design decision, the alternatives we weighed, and what we would revisit. Companion to [backend-analysis.md](backend-analysis.md) (the API contract and its gaps) and the [README](../README.md) (how to run it).

## 1. What was done

| Step | Outcome |
|---|---|
| Read the backend first | Controllers, request/result records, enums and services of the .NET API were read before any UI code. This produced the endpoint table, the contract quirks and 16 numbered gaps. |
| Foundation | SCSS design system, responsive shell (sidebar / header / bottom nav), typed API layer, auth, error handling, toasts, confirm dialog, environments, dev proxy. |
| Feature work, in parallel | Three independent slices built at the same time: tournaments; matches and live scoring; dashboard, teams, players, statistics and standings. |
| Integration | Production build, unit tests, gap list consolidated and renumbered. |
| Backend catch-up | The API later added a tournament list, player/team pools, scheduling, match scoring rule, then email sign-in and tournament ownership. The frontend followed each step (sections 2.7 to 2.9). |
| Current state (2026-11-09) | 22 spec files, 164 unit tests passing; initial bundle 316.76 kB raw / 88.87 kB transferred; Playwright specs written. |
| Not done | A run against the live backend, an in-browser layout review, running the E2E specs, any backend change. See section 4. |

The order matters: **contract first, foundation second, features third**. Every feature then sat on the same typed services and shared components, so three people (or agents) could work without stepping on each other.

## 2. Decisions and the alternatives we passed on

Each entry: the problem, what we chose, what else was possible, and the trade-off.

### 2.1 Talking to an API with no CORS policy

- **Chose:** Angular dev-server proxy (`proxy.conf.json`) forwarding `/api` to the local API; `apiBaseUrl` is the relative `/api`.
- **Alternatives:** (a) add CORS to the backend; (b) hard-code `https://localhost:7248` in the frontend.
- **Why:** (a) means changing a backend we were told not to touch, (b) scatters a URL and still fails on CORS. The proxy keeps the browser same-origin, so the app needs no CORS at all in dev and in any deployment that serves both from one origin (App Service, Front Door).
- **Cost:** a separate-origin deployment needs a CORS policy later. It is in the gap list (G6).

### 2.2 Where to absorb the API's inconsistent shapes

The API sends enums as numbers in some DTOs and as strings in others, and wraps some results in `Result<T>` while returning others bare.

- **Chose:** one mapping layer at the edge (`core/services/api/mappers.ts`): `parseEnum` accepts number or name, `unwrap()` strips the envelope. Components only ever see string unions and plain values.
- **Alternatives:** (a) handle it in each component; (b) an HTTP interceptor that rewrites responses; (c) generate a client from OpenAPI (NSwag / openapi-generator).
- **Why:** (a) leaks wire details everywhere. (b) cannot know which field is an enum without a schema. (c) is attractive, but the API ships numeric enums and no response schema for the wrapped results, so generated types would still be wrong in places.
- **Lesson:** a boundary layer is where you pay for a messy contract once. It also paid off when a feature agent found that `registration/open` returns a *value-less* `Result`; because the mapper was the single place unwrapping happened, the fix was one method (G16), not a hunt through components.
- **Revisit:** if the backend adds `JsonStringEnumConverter` and consistent envelopes, most of the mapper shrinks to nothing. The code already accepts both forms, so it keeps working through that migration.

### 2.3 UI framework: none

- **Chose:** no Angular Material. Native `<dialog>` for the confirm dialog and the mobile "More" sheet, an inline SVG icon component, a small toast service, global SCSS tokens.
- **Alternatives:** Angular Material + CDK; Tailwind; PrimeNG.
- **Why:** the brief asked for a product that does not look like a stock admin template and said to avoid unneeded dependencies. `<dialog>` already gives focus trapping, Esc handling and a backdrop. Installing packages was also blocked in the build session, so this was partly forced, but the result is a smaller bundle and total control of the look.
- **Cost:** we own accessibility details that Material would give (we mitigated with native elements, `aria-live` regions, labelled controls). There is no date picker; native date inputs are used, which is also better on phones.

### 2.4 Styling approach

- **Chose:** design tokens as CSS custom properties in `styles.scss` (colour, radius, shadow, spacing, light and dark through `prefers-color-scheme`), plus a handful of shared classes (`.card`, `.btn`, `.field`, `.badge`, `.table`, `.grid`). Components add layout-only styles.
- **Alternatives:** Tailwind utility classes; fully component-scoped styles with no global classes; a Sass theming library.
- **Why:** shared classes keep buttons, forms and cards identical across features built in parallel, and tokens give dark mode and re-theming almost free. Scoped styles for everything would have duplicated the button/form rules in every component.

### 2.5 State management: signals plus a tiny helper

- **Chose:** signals for state, RxJS only for HTTP and cancellation, and a ~40-line `AsyncState<T>` (data / loading / error signals, cancels the previous request on reload).
- **Alternatives:** NgRx / NgRx SignalStore; Angular `resource()` / `httpResource`; RxJS `BehaviorSubject` services.
- **Why:** the app is read-heavy with few cross-page interactions, so a global store would be ceremony. `resource()` APIs were still experimental. A helper class removes the repetitive loading/error boilerplate from ~20 pages without hiding what happens.
- **Revisit:** if caching across pages (for example sharing the tournament list) grows, a store or a query library (TanStack Query) becomes worthwhile. `TournamentDirectory` is already the seed of that.

### 2.6 Error handling

- **Chose:** one error interceptor converts every failure into an `ApiError` (status, backend `code`, detail, extra errors), also handling ASP.NET's validation-problem shape. Pages show `st-error-state` with Retry for failed loads; actions show a toast with the backend's own message. A 401 clears the stored token.
- **Alternative:** catch `HttpErrorResponse` in each component.
- **Why:** the backend already returns good messages (`Game.ScoreNotComplete`, `Tournament.ActiveMatches`). Surfacing them verbatim means business rules stay in one place, the backend, which was an explicit requirement.

### 2.7 Authentication (since replaced by email one-time-code sign-in)

> **Update:** the backend added passwordless email sign-in (request a 6-digit code, verify it; a new email also gives a name) and per-tournament ownership. The frontend now has a two-step sign-in page, an `AuthService` built around `userId` / `isAdmin` / `canManage(organizerUserId)`, and a profile page. The changes below show how the earlier decisions held up.
>
> What stayed: the interceptor, the token in `localStorage`, the guard idea (now `authGuard`: "signed in", not "organizer"), and the rule that the UI only decides what to *offer* while the API enforces. That is why the swap touched few files.
>
> What had to change: the permission question moved from "does this user have a role" to "does this user own this tournament", so a single global `isOrganizer()` flag was replaced by a per-tournament check (`TournamentContext.canManage`). Lesson: a boolean role check is easy to write and expensive to undo once it is in forty templates; a function that takes the resource (`canManage(tournament)`) would have been the better first shape.
>
> Two decisions in the new sign-in page worth studying: (1) when the API answers `User.NameRequired`, the page asks for the name and resubmits the same code (the backend keeps the code valid) instead of making the person start over; (2) the sixth digit submits automatically, but only when no name is needed. A bug the unit tests caught: `(ngSubmit)` only fires on forms with `[formGroup]` or `FormsModule`, so on plain forms the browser would have done a native submit and reloaded the page; those forms now use `(submit)="$event.preventDefault(); ..."`.

- **Originally chose:** a sign-in page where an organizer pastes a JWT (made with `dotnet user-jwts`); stored in `localStorage`, attached only to API-bound requests, role read from the token **only to show or hide UI**. A route guard sends guests to sign in and back.
- **Alternatives:** a fake login form; MSAL / Entra ID; httpOnly-cookie session.
- **Why:** the backend has no login endpoint, so a fake form would be dishonest. MSAL would need backend changes to validate those tokens. Pasting a token is the smallest real thing that works with the API as written.
- **Security notes:** the frontend never *decides* authorization; the API still rejects non-organizers. `localStorage` tokens are readable by any XSS. The login flow gap (G5) is closed by email sign-in, but the storage question remains: see [architecture.md](architecture.md#security-posture) for the current posture and what to do before production.

### 2.8 The missing tournament list (since resolved)

> **Update:** the backend later added `GET /api/tournaments`. `TournamentDirectory` now calls it and fetches each tournament's details in parallel; the probing code was deleted, only that one method changed, exactly as designed. The text below records the original decision, which is the useful part for learning.

- **Chose:** `TournamentDirectory` probes `GET /tournaments/1`, `/2`, ... in batches of 5 until a batch finds nothing, and caches the result. It is isolated in one service and labelled as a workaround.
- **Alternatives:** (a) keep a list of ids in `localStorage`; (b) mock data; (c) change the backend; (d) drop the tournaments list.
- **Why:** (a) breaks across browsers and users, (b) violates "no mock data when a real endpoint exists", (c) is out of scope, (d) kills the product. Probing uses real data and is easy to delete: when `GET /tournaments` exists, only `fetchAll()` changes.
- **Cost:** one request per tournament, and it assumes ids are contiguous. Fine for tens of tournaments, wrong at scale. This is the textbook example of *technical debt taken on knowingly, fenced off, and documented*.

### 2.9 Teams and players without endpoints (since resolved)

> **Update:** the backend added `/api/players` and `/api/teams`, and then made every registered user a player. Today players are the pool of registered users (signed-in users search them; there is no player create/edit form), teams are created while registering one into a tournament (global team writes are admin-only), and the public tournament payload no longer carries emails. Derivation from rosters remains for two things: per-tournament participation, and the guest player list (guests cannot read `/api/players`). A fixed seam let us swap the data source without touching the stats code. Current contract: [backend-analysis.md](backend-analysis.md).

- **Originally chose:** derive them read-only from tournament rosters (`teamId` and `playerId` identify the same team or player across tournaments), and tell the user that creating and editing are not available yet.
- **Alternatives:** local mock CRUD; hide the Teams and Players modules.
- **Why:** mock CRUD would present placeholder behaviour as real, which the brief forbade. Derivation gives real, useful views (rosters, records, MVP stats) from data we already have. The honest empty-states (for example "players can only be referenced by id") make the gap visible to the product owner instead of burying it.

### 2.10 Live scoring against a final-score-only API

This was the hardest design problem.

- **Backend reality:** `POST .../score` accepts one final score per game, once. No point-by-point endpoint, no undo, no server tracking.
- **Chose:** keep the running point count in the browser (with an undo stack, persisted to `localStorage` so a refresh or dropped connection does not lose the game), and submit the final score when the scorer taps Save. The score history is the source of truth; the totals are rebuilt from it.
- **Update:** the backend now returns `scoringRuleId` on the match, so the hint uses the match's own rule (looked up in the sports catalogue) with the tournament default only as a fallback.
- **Rule logic:** the scoring rule (points to win, win by 2, maximum) is mirrored in the page, but **only as a hint** (highlighting game point and "looks complete"). Save is enabled whenever the scores differ and the backend decides if the score is legal, with its message shown inline.
- **Alternatives:** (a) make the UI enforce the rules itself; (b) hide the rules entirely and only offer a score entry form; (c) extend the backend with point events.
- **Why:** (a) duplicates business logic, and it drifts, because GetMatch does not even return the match's rule (G12), so the page could enforce the wrong one. (b) wastes the scoring screen's value. (c) is the right long-term answer but not ours to build. The hint-only approach is usable on a phone now and cannot corrupt data.
- **Trade-off to remember:** if the scorer's device dies mid-game, the points live only in that browser until saved. Point-by-point events on the server (G7) would fix this and enable live spectators.
- **Omitted on purpose:** the serve indicator, because the backend has no serving data and inventing it would show wrong information.

### 2.11 Routing and page structure

- **Chose:** lazy-loaded route files per feature; route params bound straight to component inputs (`withComponentInputBinding`) with `paramsInheritanceStrategy: 'always'`, so tab pages inside a tournament read `:tournamentId` without touching `ActivatedRoute`. Tournament sections are child routes under one shell, with a shared tab-nav component.
- **Alternatives:** services that read `ActivatedRoute` snapshots; one big tournament page with in-page tabs.
- **Why:** inputs are the idiomatic, testable way (a test just sets the input). Child routes give every tab its own URL, so back/forward, deep links and sharing work, and each tab only loads its code when opened.

### 2.12 Responsive navigation

- **Chose:** sidebar on desktop; on phones a bottom bar with four primary destinations plus a "More" sheet for the rest; match lists degrade from tables to stacked cards.
- **Alternatives:** hamburger drawer on every size; a five-plus-item bottom bar.
- **Why:** the thumb zone is the bottom of the screen, and the brief called out mobile first. Five items is the practical limit, so the long tail moves into a sheet.

### 2.13 How the work was split

- **Chose:** I built the contract-bearing foundation myself (models, API services, shell, shared components), pinned the route map and file paths, put stubs at the cross-feature seams, then forked three agents with disjoint folders.
- **Alternatives:** build everything sequentially; give each agent its own git worktree.
- **Why:** the shared surface is small and stable once it exists, so parallel feature work is safe. Agreeing paths in advance (`TournamentMatchesPage`, `TournamentStandingsPage`, `TournamentMvpPage`) let the tournaments slice route to pages the others were still writing. Worktrees would have needed a separate `node_modules` per copy.
- **What went wrong:** the agents each numbered new backend gaps starting at G12, so there were duplicates; I renumbered them when merging. A single shared "gaps" file owned by one person would avoid it. Also, the matches/tournaments agents found real contract bugs I had missed (the value-less `Result`), which is why independent review of integration points is worth the time.

### 2.14 Testing strategy

- **Chose:** put logic in pure functions and classes (scoring session, tournament lifecycle rules, derivations, mappers) and unit-test those heavily; test API services with `HttpTestingController` against **request/response shapes copied from the backend records**; a few page tests for the main interactions.
- **Alternatives:** mostly component tests; mocks of the API services; browser E2E only.
- **Why:** pure logic is fast to test and is where bugs hide (win-by-2, deuce, undo, JWT parsing). Contract tests against real-shaped payloads catch exactly the numeric-versus-string enum class of mistakes. Browser E2E is still needed and is the biggest remaining gap.

## 3. Principles that kept showing up

1. **Read the contract before writing the UI.** The gap list came out of reading controllers and DTOs, not guessing.
2. **Isolate the ugly part.** Wire-format quirks live in one mapper file; the missing list endpoint lives in one service. When the backend improves, the change is local.
3. **Don't move business rules to the client.** The backend validates; the UI shows its message. Where the UI mirrors a rule (scoring), it is a hint and never the gate.
4. **Be honest in the product.** If something cannot be done (edit a team, create a player, see who is serving), the UI says so instead of shipping a button that pretends.
5. **Prefer the platform.** Native `<dialog>`, native date inputs, CSS variables and `prefers-color-scheme` replaced libraries.
6. **Make parallel work safe by fixing the interfaces first.** Folder ownership plus agreed file names turned three features into three independent tasks.

## 4. Known limits and what to do next

| Area | Status | Next step |
|---|---|---|
| Live backend | Not run. Everything was verified by unit tests and the build, not against a running API. | Run the happy path end to end (steps in [backend-analysis.md](backend-analysis.md#4-verification-status)) and fix whatever the contract tests could not predict. |
| E2E | Playwright specs written in `e2e/` (guest and signed-in), never run; `@playwright/test` is not installed. | Install it and run them (commands in [CONTRIBUTING.md](../CONTRIBUTING.md#end-to-end)). Extend to create tournament -> register teams -> start -> create match -> score a best-of-3. |
| Layout | Never looked at in a browser. | Check 360 px, tablet and desktop, light and dark; fix spacing issues. |
| Tournament list | Done: real endpoint (G1). One detail call per tournament for rosters (G18). | Ask for a roster-bearing or paged list if tournament counts grow. |
| Players and teams | Done: players are registered users, teams are created while registering (G2). Emails removed from public payloads (G17). | Verify on the live API. |
| Scoring | Final score only (G7); rule comes from the match (G12 resolved). | Later: point-by-point events and serve tracking. |
| Auth | Done: email one-time code (G5). Token in `localStorage`. | Decide cookie session vs `localStorage`, add a CSP, before production. |
| Deploy | Relative `/api`, dev proxy only; no CI pipeline. | Decide same-origin hosting or add CORS; set `apiBaseUrl` per environment; add a pipeline. See [architecture.md](architecture.md#6-deployment-and-environments). |
| Observability | None. | Add client error reporting before production. |
