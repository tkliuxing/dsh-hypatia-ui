# dsh-hypatia-ui

A Hypatia knowledge console for the DSH Web GUI. It adds a **Hypatia 知识库 / Hypatia Knowledge**
row to the sidebar's global panel list and opens shelf browsing, JSE search,
record inspection, a local relationship graph, and guarded deletion in the main
column.

It is the [`hypatia-archive`](https://github.com/tkliuxing/hypatia-ui) console
rebuilt as a DSH plugin: same capabilities, same non-destructive posture, but
rendered inside the shell through DSH's own extension points and theme tokens
instead of its own page.

Requires **DSH 0.1.7-rc.2 or newer** (`dsh.engines.dsh`). The plugin is a client
plugin in the sense of the DSH plugin development manual: it contributes React
components to declared slots, writes no DOM of its own, and shares only
`--dsw-alias-*` / `--dsw-radius-*` tokens with the host.

Hypatia itself is [MarchLiu/hypatia](https://github.com/MarchLiu/hypatia);
validated against **Hypatia 4.1.1**. The tag and scope rosters need **4.1.0**
or newer, and are detected at run time rather than from the version number, so
an older build still works with the reduced filter described below.

## Install

```bash
dsh plugin --profile web add @tkliuxing/dsh-hypatia-ui
```

From a checkout instead:

```bash
dsh plugin --profile web add link:/path/to/dsh-hypatia-ui
```

`hypatia` must be on `PATH`, or `HYPATIA_BIN` must point at the executable.
Restart DSH; the **Hypatia 知识库** row appears in the sidebar's panel list
under **New Session**, beside the shipped Plugins row (and the Tasks row, in a
deployment that enables it).

This package is independent of [`@tkliuxing/dsh-hypatia`](https://www.npmjs.com/package/@tkliuxing/dsh-hypatia)
(the memory-skills and sandbox-approval bundle). The two compose, and neither
needs the other.

## What it does

- **Shelves** — lists every registered shelf and works within the selected one.
- **Search** — Hypatia's JSE full-text query, then local tag and scope filters,
  paged with cursors bound to the query that issued them. The scope filter
  offers every scope the shelf uses, read with `hypatia scope list`; a Hypatia
  build without that command (the 4.0.0 release and earlier) offers only the
  scopes of the page on screen. Support is detected at run time, not from the
  version number: builds from Hypatia's main branch that have the command
  still report 4.0.0. The roster counts statements too, so a scope that only
  statements carry is offered and filters the record list to nothing. The tag
  field reads `hypatia tag list` the same way and suggests the roster entries
  matching the typed fragment (capped, so a shelf with thousands of tags never
  drops the whole vocabulary into the DOM); the filter itself stays a
  case-insensitive substring match, and a build without the command falls back
  to the tags of the page on screen.
- **Records** — the full stored body rendered as Markdown, with tags, scopes,
  and every direct incoming and outgoing statement. The renderer is the plugin's
  own (see [Markdown](#markdown)); raw HTML is dropped rather than injected, and
  a link or image only reaches the DOM after passing a protocol allowlist. An
  entry that declared `--no-embed` carries a **not in vector index** badge, in
  the row and in the inspector: Hypatia emits that flag only for entries that
  opted out, so its absence is the indexed default and stays unmarked.
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
of its own, contributed entirely through slots:

- the sidebar glyph registers into `sidebar.panellist` under the panel id
  `hypatia`, which is the sidebar's own list of global panels — it owns the row,
  the label, and the selected state;
- the console registers into the layout's keyed `main` slot under the same id,
  which is how the shell selects a global panel. Leaving the console is
  `ctx.layout.selectPanel(null)`, a service call rather than a stylesheet trick.

The console registration declares the plugin's locale namespace, so the framework
supplies its `t` seat and re-renders the entry on a Language switch; the row's
label is a thunk the sidebar re-reads, so it follows the language without a
re-registration. Nothing in the browser half reads or writes the shell's DOM, and
the deletion dialog renders inside the panel rather than portal-ing to
`document.body`.

The console keeps only the panel's own state, so leaving and re-entering the
panel starts from a fresh first page — the lifecycle the shipped Tasks page
takes. The shelf, filter, and graph-focus selections are not persisted across
that boundary.

### Markdown

DSH's `MarkdownText` lives in `@deepseek-ai/dsh-client-ui-primitives`, and the
plugin development manual forbids a plugin from requiring a Harness Client
package as a module: those packages change without notice — DSH 0.1.7 renamed
the whole icon set — and a throwing component blanks the slot entry it renders
in. The console therefore parses stored Markdown itself, with the same
micromark/GFM grammar DSH uses (`micromark`, `micromark-extension-gfm`,
`mdast-util-from-markdown`, `mdast-util-gfm`) and builds a React tree from the
mdast.

Supported: headings, paragraphs, emphasis, strong, strikethrough, inline code,
fenced and indented code blocks with a copy control, blockquotes,
ordered/unordered/task lists, tables, thematic breaks, hard breaks, links
(inline, reference, and autolink), images, and footnotes. Deliberately out of
scope against the host renderer: syntax highlighting, TeX math, and file or path
mentions — this console shows stored knowledge bodies, not transcripts.

The icons follow the same rule: `src/client/icons.tsx` carries glyphs copied from
DSH's product icon set and renamed under the plugin's own components.

### Request trust

DSH's web server authenticates its **own** API routes; a route a plugin
registers is not one of them. These routes reach a CLI that can delete
knowledge, so the plugin enforces its own boundary: the connecting socket must
be loopback **and** the request must be same-origin with the server's authority.
A page on another origin fails the second check even from the same machine, and
a bare `curl` — which sends neither `Origin` nor `Sec-Fetch-Site` — is refused.

The desktop build cannot meet that second check: it serves the page from
`dsh-app://app`, and its proxy deletes `Host`, `Origin`, `Sec-Fetch-Site` and
`Cookie` before forwarding, then sets the Host's own session cookie. The
forwarding `fetch` puts `Host` back from the target URL, so what actually
arrives carries no browser marker — no `Origin`, no `Sec-Fetch-Site` — and that
cookie. The plugin admits exactly that shape. No current browser can produce it,
since every request one makes carries `Sec-Fetch-Site`; the loopback socket
still bounds who can reach the port, and the cookie keeps a bare `curl` out.
Verified against desktop build `0.2.1-rc.3`; see issue
[#3](https://github.com/tkliuxing/dsh-hypatia-ui/issues/3).

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
answers **only** the shell's seeded module table. In DSH 0.1.7 that table is
`packages/client/web/src/platform.ts` — `react`, `react/jsx-runtime`,
`react-dom`, `react-dom/client`, `@deepseek-ai/cordis`,
`@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
`@deepseek-ai/dsh-client-ui-primitives`, and
`@deepseek-ai/dsh-client-ui-dockkit`. Anything else must be bundled in, since a
specifier the table cannot answer is a runtime throw rather than a build error.
`tsdown.config.ts` allowlists only the first seven; leaving the last two out turns
a careless import of a Harness Client package into a build-time resolution
instead. `cytoscape` and the Markdown pipeline are the bundled third-party
dependencies.

The factory takes only `require`, so the CJS body's `module` and `exports` have
no binding of their own; `tsdown.config.ts` supplies them through `intro`.
Without it the bundle throws `exports is not defined` the moment the loader
executes it.

## License

[MIT](LICENSE)
