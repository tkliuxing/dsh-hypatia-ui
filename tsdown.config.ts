/**
 * Two artifacts from one package, because the two halves run in different
 * worlds and DSH resolves them differently.
 *
 * **Node half** (`lib/index.js`): an ordinary ESM module the Loader imports
 * from a real install, so production dependencies stay imports and everything
 * else inlines.
 *
 * **Browser half** (`lib/client.js`): the lazy-CJS factory artifact DSH's
 * client module system expects — the file registers itself with
 * `window.__ModuleLoader__` and receives a `require` that answers only the
 * shell's seeded module table. That table holds `react`, `react-dom`,
 * `react-dom/client`, `@deepseek-ai/cordis`, and the three shared client
 * libraries; a specifier it cannot answer is a runtime throw, so **everything
 * else must be bundled in** — which is exactly what `alwaysBundle` below
 * enforces for cytoscape and the wire types.
 *
 * The banner/footer shape mirrors the harness's own `clientBundle` preset; it
 * is the contract the loader reads, not a stylistic choice.
 *
 * @module dsh-hypatia-ui/tsdown.config
 */

import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

/**
 * Package name. This is stamped into the `__ModuleLoader__.load` registration
 * and MUST stay identical to package.json's `name`: DSH serves the artifact at
 * `/plugins/<package-name>/client.js` and keys its boot-graph entry by that
 * name, so a mismatch registers the factory under a name nothing requests and
 * the browser half silently never loads.
 */
const PACKAGE_NAME = '@tkliuxing/dsh-hypatia-ui'

/** Production dependencies of the Node half: present on disk, kept as imports. */
const NODE_EXTERNALS = new Set(['schemastery'])

/**
 * The module table the shell seeds. These stay imports in the browser bundle;
 * anything else is inlined, because the loader's `require` cannot answer it.
 */
const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

const NODE_ENV = process.env['NODE_ENV'] ?? 'production'

export default defineConfig([
  {
    name: PACKAGE_NAME,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2023',
    fixedExtension: false,
    // Types ship from lib/types (tsc), so neither artifact emits its own.
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: (specifier: string) => NODE_EXTERNALS.has(specifier),
      alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !NODE_EXTERNALS.has(specifier),
    },
    outputOptions: { entryFileNames: 'index.js' },
  },
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    // CJS: the factory body is handed a `require`, and its `module.exports`
    // is what the loader materializes as the plugin.
    format: ['cjs'],
    platform: 'browser',
    target: 'es2023',
    fixedExtension: false,
    dts: false,
    // clean must stay off: a default clean would wipe the node half emitted above.
    clean: false,
    // Plugin code is fetched outside Vite's module graph, so the bundle has to
    // carry its own map for browser profiling tools to resolve TS/TSX.
    sourcemap: true,
    deps: {
      neverBundle: (specifier: string) => CLIENT_EXTERNALS.has(specifier),
      alwaysBundle: (specifier: string) => !CLIENT_EXTERNALS.has(specifier),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          NODE_ENV === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    // Bundled browser dependencies read Node idioms (cytoscape probes
    // process.env.NODE_ENV); a CJS output carries no import.meta, so both keys
    // are substituted at build time or the factory throws at boot.
    define: {
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'import.meta.env.MODE': JSON.stringify(NODE_ENV),
      'import.meta.env': JSON.stringify({ MODE: NODE_ENV }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      // The factory takes only `require`, so the CJS body's `module` and
      // `exports` have no binding of their own — rolldown does not emit one
      // for a CJS chunk. Without this intro the bundle throws
      // "exports is not defined" the moment the loader executes it.
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
