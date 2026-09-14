# dsh-hypatia-ui

A Hypatia knowledge console for the DSH Web GUI. It adds a **Hypatia 知识库 / Hypatia Knowledge**
entry to the sidebar — beside the task board and the other panel plugins — and
opens shelf browsing, JSE search, record inspection, a local relationship graph,
and guarded deletion in the main column.

It is the [`hypatia-archive`](https://github.com/tkliuxing/hypatia-ui) console
rebuilt as a DSH plugin: same capabilities, same non-destructive posture, but
rendered with DSH's own theme tokens, markdown renderer, and icon set instead of
its own page.

Hypatia itself is [MarchLiu/hypatia](https://github.com/MarchLiu/hypatia);
validated against **Hypatia 0.3.0**.

## Install

```bash
dsh plugin --profile web add @tkliuxing/dsh-hypatia-ui
```

From a checkout instead:

```bash
dsh plugin --profile web add link:/path/to/dsh-hypatia-ui
```

`hypatia` must be on `PATH`, or `HYPATIA_BIN` must point at the executable.
Restart DSH; the sidebar entry appears under **New Session**.

This package is independent of [`@tkliuxing/dsh-hypatia`](https://www.npmjs.com/package/@tkliuxing/dsh-hypatia)
(the memory-skills and sandbox-approval bundle). The two compose, and neither
needs the other.

## What it does

- **Shelves** — lists every registered shelf and works within the selected one.
- **Search** — Hypatia's JSE full-text query, then local tag and scope filters,
  paged with cursors bound to the query that issued them.
- **Records** — the full stored body rendered through DSH's markdown renderer
  (raw HTML and unsafe protocols disabled), with tags, scopes, and every direct
  incoming and outgoing statement.
- **Graph** — a local map around one focused entity: its direct relationships,
  expandable node by node, with an in-console Back through previous focus
  states. A statement referring to a deleted record stays visible as a dashed
  reference node.
- **Deletion** — previews the impact, requires the exact record name retyped,
  and only removes related statements when explicitly asked. **Hypatia's own
  `knowledge-delete` does not cascade to statements, and neither does this.**
- **Bulk deletion** — a checkbox column on the record list, select-all for the
  page on screen, and one dialog that lists exactly what will go and asks for
  the number of records to be retyped. Up to 50 records per batch. A batch is
  **not a transaction**: the records go one at a time behind a single queue
  slot, one that is already gone or that fails is stepped over rather than
  aborting the rest, and the receipt names every such record. Selection is
  scoped to the page — paging, filtering, refreshing, or switching shelves
  clears it, so nothing invisible is ever included in a deletion.

## Configuration

Override from a profile's `cordis.patch.yml`:

```yaml
- id: hypatia-ui
  config:
    enabled: true              # master switch (routes + browser surfaces)
    announceToAgent: false     # add a system-prompt section describing the console
    binary: /abs/path/hypatia  # defaults to $HYPATIA_BIN, then `hypatia` on PATH
    timeoutMs: 20000           # per-CLI-invocation timeout
```

`announceToAgent` is off by default: the console is a human surface, and the
section costs prompt tokens in every request.

## How it is put together

Two halves in one package, the shape DSH's loader expects.

**Host half** (`exports "."`) owns the `hypatia` CLI and registers one prefix
route family, `/api/dsh-hypatia`, on `ctx.webServer`. Two properties are
load-bearing:

- **Serialized invocation.** A Hypatia shelf store admits one CLI process at a
  time, so every call queues behind the previous one. Deletion additionally
  serializes its read-then-write sequence against other deletions.
- **argv, never a shell string.** Record names, JSE payloads, and predicates are
  user data; they reach `spawn` as an argv array with `shell: false`.

**Browser half** (`exports "./client"`) is a same-origin view with no authority
of its own. DSH's sidebar declares no slot an external plugin may occupy, and
the center column is single-occupant, so both surfaces are injected at the DOM
level — the same approach the task-board plugin takes, and the reason the two
order predictably beside each other and evict each other through the shared
`dsh-panel-activate` event.

### Request trust

DSH's web server authenticates its **own** API routes; a route a plugin
registers is not one of them. These routes reach a CLI that can delete
knowledge, so the plugin enforces its own boundary: the connecting socket must
be loopback **and** the request must be same-origin with the server's authority.
A page on another origin fails the second check even from the same machine, and
a bare `curl` — which sends neither `Origin` nor `Sec-Fetch-Site` — is refused.

The retyped-name confirmation is re-checked on the Host, so a caller that skips
the dialog is refused the same way the dialog refuses it. A bulk deletion is
confirmed the same way, by the retyped record *count*: the Host deduplicates
the name list, caps it, and refuses a count that does not match it.

## Development

```bash
pnpm install
pnpm build      # tsc declarations + both bundles
pnpm test
pnpm typecheck
```

`pnpm watch` rebuilds on change; DSH stat-polls the client bundle and hot-reloads
the plugin, so a browser refresh is usually unnecessary.

To try it against a source checkout of the harness without touching an existing
profile:

```bash
dsh plugin --profile scratch add link:/path/to/dsh-hypatia-ui
# add "@deepseek-ai/dsh-web-app" to dsh.profile.bundles in the new profile
dsh --profile scratch --port 3099
```

### Two build notes worth knowing

The browser artifact is the lazy-CJS factory DSH's client module system loads:
it registers itself with `window.__ModuleLoader__` and receives a `require` that
answers **only** the shell's seeded module table (`react`, `react-dom`,
`react-dom/client`, `@deepseek-ai/cordis`, and the shared client libraries).
Anything else must be bundled in — a specifier the table cannot answer is a
runtime throw, not a build error. That table is also why `cytoscape` is the only
bundled dependency: markdown, icons, and controls all come from
`@deepseek-ai/dsh-client-ui-primitives`, which is shared and costs nothing.

The factory takes only `require`, so the CJS body's `module` and `exports` have
no binding of their own; `tsdown.config.ts` supplies them through `intro`.
Without it the bundle throws `exports is not defined` the moment the loader
executes it.

## License

[MIT](LICENSE)
