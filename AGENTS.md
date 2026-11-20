# AGENTS.md

## Project

Reactive Chat: a real-time group chat written in reactive style with RxJS on both ends.

- `back-end/` — Node WebSocket server (`ws` + RxJS), run with `tsx`, tested with Vitest.
- `front-end/` — Angular 22 client (standalone components, RxJS), tested with `ng test` (Vitest).
- `docs/requirements.md` — functional requirements (FR-xx). FR-01 to FR-08 are implemented;
  do not change their behaviour.
- `docs/architecture.md` — every rule below with a bad and a good example. Read it before
  writing stream code.

## Where code goes

| Kind of code | Back-end | Front-end |
| --- | --- | --- |
| Protocol types + validation (shared, identical copies) | `src/domain/events.ts` | `src/app/domain/events.ts` |
| Pure logic: no rxjs, no ws, no Angular | `src/domain/` | `src/app/domain/` |
| Observable pipelines, operators, time logic | `src/streams/` | `src/app/streams/` |
| I/O adapters (WebSocket, HTTP, browser APIs as services) | `src/streams/socket.ts` | `src/app/services/` |
| Wiring / subscribing | `src/server.ts` (only place that subscribes) | components: `src/app/chat/**`, `src/app/app.ts` |
| Tests | `*.spec.ts` next to the file | `*.spec.ts` next to the file |

Prefer writing stream logic as an exported pure function `(input$, ...) => Observable` in
`streams/` and testing it with marble tests (`TestScheduler`), then wiring it in
`server.ts` / a component.

## Rules

- **R1 Imports only point inward.**
  back-end: `src/domain` ← `src/streams` ← `src/server.ts`.
  front-end: `app/domain` ← `app/streams` ← `app/services` ← components.
  `domain` never imports rxjs, ws or Angular.
- **R2** `back-end/src/domain/events.ts` and `front-end/src/app/domain/events.ts` are
  identical. Change one, copy it to the other.
- **R3** Subjects are private: never exported, never `public`/`protected`, never part of a
  public type. Expose an Observable and/or a method instead.
- **R4** `.subscribe()` only in `back-end/src/server.ts`; never in the front-end (not even
  in tests). Front-end consumes streams with the `async` pipe or `toSignal`; tests use
  marble tests, `firstValueFrom`/`lastValueFrom`.
- **R5** No nested subscribe. Compose with `switchMap`/`mergeMap`/`concatMap`/`exhaustMap`.
- **R6** `toSignal` only in components.
- **R7** Time logic (debounce, throttle, timers, delays) is a pure function in `streams/`
  with a marble test (`TestScheduler`) in its `.spec.ts`. No `setTimeout`/`setInterval`.
- **R8** Bad input never kills a stream: parse to `null` + `filter`, or `catchError`.
  Every input boundary has a test that feeds it garbage.
- **R9** Observable names (variables, parameters, properties) end in `$`.

Enforcement: ESLint (typescript-eslint, angular-eslint, eslint-plugin-rxjs-x) and
dependency-cruiser in each folder, plus `scripts/check-contract.sh` (R2),
`scripts/check-time-logic.sh` (R7) and `scripts/check-guards.sh`. R8 is enforced by tests.

## Commands

```bash
bash scripts/validate.sh          # everything, both folders (what "done" means)

cd back-end  && npm run typecheck && npm run lint && npm run lint:deps && npm test
cd front-end && npm run typecheck && npm run lint && npm run lint:deps && npm test && npx ng build --configuration development
```

## Definition of done

Done = `bash scripts/validate.sh` prints `ALL CHECKS PASSED`.
Never disable rules or delete tests. (No `eslint-disable`, `@ts-ignore`, `.skip`/`.only`,
no weakening of `eslint.config.*`, `.dependency-cruiser.cjs` or `scripts/`.) If a rule
blocks you, change the design, not the rule.

A Claude Code Stop hook (`.claude/settings.json` → `scripts/stop-hook.sh`) runs
`validate.sh` and blocks finishing while it fails.
