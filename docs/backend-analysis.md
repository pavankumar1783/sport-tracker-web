# Backend contract and gaps

What the SportTracker API (.NET 10, Clean Architecture) offers this frontend today, the quirks the frontend absorbs, and every known gap with its status. This is the single source of truth for the contract; the history of how it evolved is at the bottom.

- **Backend source:** repo `SportTracker` (not part of this repo). Current as of backend commit `653287d` (email sign-in and tournament ownership).
- **How this was established:** read from controllers, request/result records and domain models, then covered by `HttpTestingController` tests. **Not yet verified against a running instance** (see "Verification status").
- **Scope:** table tennis only.
- Related: [architecture.md](architecture.md) (how the frontend uses this), [design-decisions.md](design-decisions.md) (why).

## 1. API surface used by the frontend

All routes are under `/api`. Access: **Public** = anonymous allowed; **Signed in** = any valid token; **Owner** = the tournament's organizer or a site admin (else 403 `Tournament.Forbidden`); **Admin** = token role `Organizer`. Guests calling a protected route get 401 `Auth.Required`.

| Area | Endpoint | Access | Client method |
|---|---|---|---|
| Auth | `POST /auth/otp/request {email}` | Public (rate limited) | `AuthApi.requestOtp` |
| | `POST /auth/otp/verify {email, code, name?}` returns `{accessToken, expiresAt, user}` | Public | `AuthApi.verifyOtp` |
| Sports | `GET /sports` (sports, formats, scoring rules) | Public | `SportsApi.getSports` |
| Tournaments | `GET /tournaments` (summary with `teamCount`); `?mine=true` adds `myRoles` | Public; `mine` needs sign-in | `TournamentsApi.list` |
| | `POST /tournaments` (creator becomes organizer) | Signed in | `create` |
| | `GET /tournaments/{id}` (details, teams, rosters, `organizerUserId`) | Public | `get` |
| | `POST /tournaments/{id}/configure` (create stages for a format) | Owner | `configure` |
| | `POST /tournaments/{id}/registration/open` | Owner | `openRegistration` |
| | `POST /tournaments/{id}/teams` (register team and roster; `teamName` creates a team inline) | Owner | `registerTeam` |
| | `PUT /tournaments/{id}/teams/{tournamentTeamId}` (rename for this tournament) | Owner | `updateTeam` |
| | `POST /tournaments/{id}/start`, `/complete` | Owner | `start`, `complete` |
| | `GET /tournaments/{id}/stages`, `/dashboard`, `/standings`, `/mvp` | Public | `getStages`, `getDashboard`, `getStandings`, `getMvp` |
| Match settings | `GET /tournaments/{id}/match-settings` | Public | `getMatchSettings` |
| | `PUT /tournaments/{id}/match-settings` | Owner | `configureMatchSettings` |
| Matches | `GET /tournaments/{id}/matches`, `GET .../matches/{mid}` | Public | `MatchesApi.list`, `get` |
| | `POST .../matches` (with optional `scheduledAt`) | Owner | `create` |
| | `POST .../matches/{mid}/start`, `/walkover`, `/cancel` | Owner | `start`, `walkover`, `cancel` |
| | `POST .../matches/{mid}/games`, `.../games/{gid}/start`, `.../games/{gid}/score` | Owner | `createGame`, `startGame`, `recordScore` |
| Players | `GET /players?search=`, `GET /players/{id}` (no emails) | Signed in | `PlayersApi.search`, `get` |
| | `GET /players/me`, `PUT /players/me` (rename yourself; the only place an email is returned) | Signed in | `PlayersApi.me`, `updateMe` |
| Teams | `GET /teams`, `GET /teams/{id}` | Public | `TeamsApi.list`, `get` |
| | `POST /teams`, `PUT /teams/{id}` | Admin | `TeamsApi.create`, `update` |

Backend endpoints the frontend does not call: `GET /tournaments/{id}/teams` and `POST /tournaments/{id}/competition-entries` (individual entries; known issue G11).

### Permission model

Token role is `User` or `Organizer` (the site admin). `sub` is the numeric user id. Every account is also a player. Anyone signed in may create a tournament and then owns it. Other users may read it but cannot write (403). Details of the sign-in flow and limits (6 digits, 5 min, 5 attempts, 60 s cooldown, 5 per hour with 429 `Otp.TooManyRequests`) are in [architecture.md](architecture.md#4-identity-and-authorization).

## 2. Contract quirks the frontend absorbs

1. **Enums are numeric on the wire** (no `JsonStringEnumConverter`), but several DTOs carry `status` as a string (`"Draft"`). `core/models/enums.ts` and `parseEnum` accept both and produce string unions.
2. **Mixed envelopes.** Start tournament, create match, create game, start match, start game and record score return `Result<T>` (`{isSuccess, isFailure, errors, value}`); the rest return the bare value. `unwrap()` strips the envelope.
3. **`registration/open` returns a value-less `Result`** (no payload), unlike the other wrapped calls (G16). Handled in `TournamentsApi.openRegistration`.
4. **Errors** are `ProblemDetails` with a `code` extension (and an `errors` array for several). `*.NotFound` is 404, other business errors 400, plus 401, 403 and 429. `ApiError` carries all of it.
5. **Dates** from the server have no timezone suffix; they are UTC and parsed with `asUtc`.
6. **Game scoring is final-score only.** `POST .../score` takes `{side1Score, side2Score}` once per game; the backend validates it against the scoring rule (`Game.ScoreNotComplete`). See G7.
7. **Tokens** from `dotnet user-jwts` carry no numeric `sub`; the frontend tolerates that (`userId` is null) but such a token cannot own tournaments.

## 3. Gap register

Status: **Open** = needs backend work; **Resolved** = backend closed it and the frontend uses it; **Handled** = frontend works around it, backend unchanged.

| # | Gap | Status | Frontend impact or workaround |
|---|---|---|---|
| G1 | No `GET /tournaments` list | Resolved | `TournamentDirectory` calls it, then fetches each tournament's details in parallel (see G18). |
| G2 | No player or team endpoints | Resolved | `/players` is now the pool of registered users (signed in); `/teams` has create/update for admins. Organizers create teams while registering one. Guests see a player list derived from rosters. |
| G3 | No update or delete for tournaments | Open | No edit or delete screens. Teams are renamed per tournament; users rename themselves. |
| G4 | No `scheduledAt` on match create | Resolved for creation | Kick-off field exists. **Rescheduling after creation is open.** |
| G5 | No sign-in endpoint | Resolved | Email one-time-code sign-in. |
| G6 | No CORS policy | Open (Handled) | Dev proxy; same-origin hosting. A cross-origin deployment needs a policy. |
| G7 | No point-by-point scoring, undo or serving info | Open (Handled) | Points counted in the browser and persisted per game in `localStorage`; final score submitted. No serve indicator. Unsaved points are device-local. |
| G8 | No cross-tournament queries (upcoming matches, recent results, player history, player/team stats beyond standings and MVP) | Open (Handled) | Dashboard, statistics and player history fan out per tournament (`InsightsService`). |
| G9 | Standings and MVP are tournament-wide only | Open | No group tables. |
| G10 | Knockout and group-to-knockout only create stage records; no brackets or advancement (deferred by the backend owner) | Open | Not built. |
| G11 | `RegisterCompetitionEntry` throws on a null player list and allows a player in several singles entries | Open | Endpoint not used by the frontend. |
| G12 | Match details lacked the scoring rule | Resolved | `scoringRuleId` returned; live scoring looks it up in `/sports`. |
| G13 | Dashboard match items carry side numbers but no side ids | Open | Winner cannot be highlighted on dashboard-sourced cards. |
| G14 | Match lists carry no scores or game counts | Open (Handled) | One `GET match` per match when scores are needed. |
| G15 | No per-tournament totals of games or points | Open (Handled) | Statistics sums them from standings rows. |
| G16 | `registration/open` returns a value-less `Result`; server timestamps have no `Z` | Open (Handled) | Handled in `TournamentsApi.openRegistration` and `asUtc`. |
| G17 | Public tournament response included every player's email | Resolved | Emails removed from public responses and from the models. |
| G18 | `GET /tournaments` returns a summary only, so rosters cost one request per tournament | Open (Handled) | Parallel fetch. Ask for a roster-bearing or paged list if counts grow. |

Numbering note: the first feature agents each started new gaps at G12, so some numbers were reassigned during the merge. The table above is the current numbering. Keep one owner for this file to avoid repeats.

### Backend asks, in priority order

1. Verify and, if needed, apply the `AddUsersAndTournamentOwnership` migration on every environment (a later end-to-end run in the backend repo shows it applied on LocalDB).
2. CORS policy, if the app will be hosted on a different origin (G6).
3. Point-by-point scoring events (G7) for durable live scoring and spectators.
4. Cross-tournament and roster-bearing list endpoints (G8, G18) to remove client fan-out.
5. Tournament edit/delete and match rescheduling (G3, G4).
6. Consistent string enums and envelopes (quirks 1 to 3), after which `mappers.ts` mostly collapses.

## 4. Verification status

Checked on 2026-11-09:

- `npx ng test --watch=false`: 22 spec files, **164 tests passing**.
- `npm run build`: succeeds. Initial bundle 316.76 kB raw / 88.87 kB estimated transfer.
- **Not verified:** a run against a live backend, and any in-browser check (layout at 360 px, tablet, desktop, light and dark).
- **Playwright:** specs exist in `e2e/` (`guest.spec.ts`, `signed-in.spec.ts`) but `@playwright/test` is not installed (not in `package.json`, not in `node_modules`), so they have never run. Setup: [CONTRIBUTING.md](../CONTRIBUTING.md#end-to-end).

First live run: start the API in Development with `Auth:Otp:FixedCode` set (for example `123456`) and `Auth:Jwt:SigningKey` configured, start `npm start`, sign in with any email and the fixed code, then walk: create tournament -> configure format -> open registration -> register two teams -> start -> create match -> start match -> start game -> score -> complete. Record any contract mismatch here as a new gap.

## 5. History

The contract evolved in three steps; the frontend followed each. The reasoning is in [design-decisions.md](design-decisions.md).

1. **First read.** No list endpoint, no player/team endpoints, no sign-in, no scheduling. The frontend probed ids to list tournaments, derived teams and players from rosters, and took a pasted JWT.
2. **Second backend session.** Added `GET /tournaments`, `/players`, `/teams`, `scheduledAt` and `scoringRuleId`. Closed G1, G2 (partly), G4 (creation), G12. Found G17 and G18.
3. **Email sign-in and ownership (`653287d`).** Passwordless OTP, per-tournament ownership, `mine`/`myRoles`, players as registered users, emails removed from public payloads. Closed G5, G17 and finished G2.
