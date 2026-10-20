# Coverage analysis — 2026-10-20

Baseline: `main` at `d9dbb55ee0a4187741dd423dea09dc983742a1f2`.
Both measurements use Node 20.20.2, Vitest 1.6.1 and V8 coverage over
`src/**/*.ts`, excluding declaration files and `src/index.ts`. The CLI baseline
was rerun with the same coverage scope and provider as this change. Unexecuted
source files are included; low-coverage modules have not been excluded.

## Results

| Package | Tests before → after | Lines/statements before → after | Functions before → after | Branches before → after |
| --- | --- | --- | --- | --- |
| Server | 397 → 424 | 50.14% → 68.72% | 55.30% → 83.24% | 76.37% → 75.92% |
| CLI | 90 → 127 | 48.15% → 54.97% | 56.55% → 66.66% | 51.92% → 66.03% |

V8 discovers additional branches when previously unexecuted functions run.
That changes the branch denominator and explains the small server branch-rate
decrease despite substantially more exercised code. Coverage shows execution,
not correctness; the assertions below check behavior as well as execution.

## Gaps addressed

- **MCP protocol routing:** 16 integration tests use the actual SDK client/server
  with in-memory transport and a temporary SQLite database. They exercise tool
  discovery, task/comment/link/hierarchy/queue operations, ownership, resources,
  validation and error responses. Tool-handler line coverage rises from 34.72%
  to 96.52%; resource handlers from 42.72% to 98.18%.
- **SignalR broadcaster:** 11 deterministic tests exercise reconnects, group
  registration, bounded buffering, FIFO delivery, retry behavior, rate limits,
  notifications and shutdown. Line coverage rises from 0% to 99.39%. The SDK
  connection is mocked; these tests do not establish live-hub interoperability.
- **Task-list CLI:** 20 command-execution tests cover default completed-task
  exclusion, explicit opt-in, conflicting filters, invalid input, pagination,
  projection, output and failures. Line and branch coverage are both 100%.
  Protocol tests separately verify exclusion before pagination and totals.
- **CLI connections and output:** 3 lifecycle tests cover reuse, disconnect and
  retry; 14 formatter tests cover hierarchy and statistics output, including
  empty inputs and color modes. Connection and tree formatting reach 100% line
  coverage; statistics formatting reaches 98%.

## Remaining priorities

| Priority | Area | Current line coverage | Next useful tests |
| --- | --- | --- | --- |
| High | CLI destructive actions (`commands/task/delete.ts`) | 14.09% | Execute commands with confirmation acceptance/refusal, force mode, invalid IDs, partial failures and connection errors; assert exactly which IDs reach the server. |
| High | Other CLI command actions (including `commands/queue.ts`) | Queue: 22% | Exercise parsing and service calls through Commander, with output assertions and error exit codes; registration-only tests leave action bodies untouched. |
| Medium | Transport startup/shutdown | stdio: 0%; legacy SSE: 30.44% | Lifecycle tests for disconnects, session cleanup and transport errors; the in-memory protocol suite does not exercise network or process transports. |
| Medium | Database bootstrap | `db/init.ts`: 0% | Test fresh database initialization and startup failures using isolated temporary paths. Existing service tests exercise database operations but bypass the application bootstrap. |
| Medium | MCP failure paths and CLI network errors | See HTML report | Extend protocol tests for malformed resource URIs and service failures; test client timeout, reconnect and malformed-response behavior. |
| Lower | OpenAPI schema and declaration/re-export modules | See HTML report | Prefer contract assertions for documented endpoints over tests that merely import static declarations to raise a percentage. |

Core task, queue, link and history services already had comparatively strong
coverage. The new work targets the less-tested boundaries between those
services, the protocol, notifications and CLI execution.

## Reproduce and maintain

Run from the repository root using Node 20:

```bash
npm ci
npm run test:coverage
cd tko-cli
npm ci
npm run test:coverage
```

Each package writes `coverage/index.html`, `coverage/coverage-summary.json`,
`coverage/coverage-final.json` and `coverage/lcov.info`. Open the HTML report to
inspect uncovered lines and branches.

CI now runs both coverage suites and uploads their reports as the
`coverage-reports` artifact (14-day retention). Global percentage floors are:

| Package | Lines | Statements | Branches | Functions |
| --- | --- | --- | --- | --- |
| Server | 68 | 68 | 75 | 82 |
| CLI | 54 | 54 | 65 | 66 |

These floors preserve most of the measured improvement, with limited headroom
for provider/platform variation. Raise them as remaining gaps are addressed.
They are not per-file guarantees and do not replace review of changed code.

## Completed-task listing contract

`tko t ls` sends `exclude_status: ["complete"]` to the server by default.
`--includeStatus complete` removes this implicit exclusion. Explicit
`--excludeStatus` still wins, and `--status` still narrows results. For only
completed tasks use `tko t ls --includeStatus complete --status complete`.
Filtering on the server keeps counts and pagination consistent. Server API and
queue defaults are unchanged.
