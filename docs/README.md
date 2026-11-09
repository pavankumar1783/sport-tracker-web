# SportTracker Web: documentation index

| Document | What it answers |
|---|---|
| [../README.md](../README.md) | How do I run it? Commands, configuration, accounts |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How do I change it? Conventions, recipes, testing, definition of done |
| [architecture.md](architecture.md) | How is it built and deployed? Context, structure, flows, security, quality, risks, glossary |
| [backend-analysis.md](backend-analysis.md) | What does the API give us and what is missing? Endpoints, quirks, gap register, verification status |
| [design-decisions.md](design-decisions.md) | Why is it built this way? Each decision with alternatives and trade-offs |

## Reading paths

**Developer (new to the repo), about 1 hour**
1. [README](../README.md): run it and sign in.
2. [architecture.md](architecture.md) sections 2 (structure, routes) and 3 (data flow).
3. [CONTRIBUTING.md](../CONTRIBUTING.md): conventions and the "add a page" and "add an API call" recipes.
4. [backend-analysis.md](backend-analysis.md) section 1 (API surface) and 2 (quirks) when you touch an endpoint.

**Solution architect**
1. [architecture.md](architecture.md) from the top: context, structure, identity and security, lifecycle and scoring, deployment, quality attributes, risks, decision index.
2. [backend-analysis.md](backend-analysis.md) sections 3 and 4: open gaps and what has not been verified.
3. [design-decisions.md](design-decisions.md) section 4: known limits and next steps.

**System-design learner**
1. [design-decisions.md](design-decisions.md) in order. Start with section 3 (principles), then read 2.2 (boundary layer), 2.7 (auth and its lessons), 2.10 (live scoring against a limited API) and 2.13 (splitting work).
2. [architecture.md](architecture.md) sections 4 and 5 to see the same decisions drawn as diagrams.
3. [backend-analysis.md](backend-analysis.md) section 5 (history) to watch a contract evolve and how isolating the ugly parts kept the changes small.

Exercise: pick a risk from [architecture.md section 8](architecture.md#8-risks-and-roadmap) and sketch how you would remove it, then compare with the "Revisit" notes in the decisions log.

## Keeping these current

- Change routes or add a feature: update the route table in `architecture.md`.
- Change or discover an API behavior: update `backend-analysis.md` (one owner for gap numbers).
- Make a design choice worth explaining: add an entry to `design-decisions.md` and a row to the decision index in `architecture.md`.
- Test counts and bundle size in the docs are snapshots dated 2026-11-09; refresh them with `npx ng test --watch=false` and `npm run build` when you cite them.
