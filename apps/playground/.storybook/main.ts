// This file has been automatically migrated to valid ESM format by Storybook
// (SB10 loads it as real ESM — `__dirname`/`require` are no longer provided).
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-native-web-vite';

// Sidebar "Open in editor" is served by launch-editor inside this dev-server
// process. Its lookup order is LAUNCH_EDITOR -> running-editor process scan ->
// VISUAL -> EDITOR; when nothing matches it fails silently in the UI ("Could
// not open … in the editor." only in the server log). Default the LAST
// fallback to VS Code's CLI so the button works out of the box without an
// editor running — any explicit env or a detected running editor still wins.
if (!process.env.LAUNCH_EDITOR && !process.env.VISUAL && !process.env.EDITOR) {
  process.env.EDITOR = 'code';
}

// `.storybook` lives at apps/playground/.storybook, so three levels up is the
// monorepo root.
const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CONFIG_DIR, '../../..');
const EMPTY_STUB = path.join(CONFIG_DIR, 'stubs/empty.ts');

const fromRoot = (p: string) => path.join(REPO_ROOT, p);

// ---------------------------------------------------------------------------
// Resolve alignment — ported from development/rspack/rspack.base.config.ts
// (baseResolve, web chain). Vite alias entries use RegExp `find` for the
// webpack `$` exact-match semantics and plain string `find` for prefix mocks.
// Order is significant: most specific first (Vite uses first match).
// ---------------------------------------------------------------------------
const NODE_BUILTIN_STUBS = [
  'path',
  'https',
  'http',
  'net',
  'dgram',
  'zlib',
  'tls',
  'child_process',
  'fs',
  'util',
  'os',
];

// react-native/Libraries/* deep imports that DO have a react-native-web
// counterpart (rspack parity — see baseResolve). Single source of truth: these
// become exact-match aliases below, and their ids are the pass-through
// allowlist for the pre-resolve stub plugin in viteFinal — every OTHER
// react-native/Libraries/* id is stubbed there (RNW ships no Libraries/ dir,
// and the framework's broad react-native -> react-native-web prefix alias
// rewrites such ids into non-existent files that crash the esbuild dep-scan;
// first hit was @rozenite's WebSocketInterceptor import).
const RNW_LIBRARIES_REMAPS: [id: string, rnwPath: string][] = [
  [
    'react-native/Libraries/Components/View/ViewStylePropTypes',
    'react-native-web/dist/exports/View/ViewStylePropTypes',
  ],
  [
    'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter',
    'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
  ],
  [
    'react-native/Libraries/vendor/emitter/EventEmitter',
    'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
  ],
  [
    'react-native/Libraries/vendor/emitter/EventSubscriptionVendor',
    'react-native-web/dist/vendor/react-native/emitter/EventSubscriptionVendor',
  ],
  [
    'react-native/Libraries/EventEmitter/NativeEventEmitter',
    'react-native-web/dist/vendor/react-native/NativeEventEmitter',
  ],
];
const RNW_REMAPPED_LIBRARY_IDS = new Set(
  RNW_LIBRARIES_REMAPS.map(([id]) => id),
);

const ONEKEY_ALIASES: { find: RegExp; replacement: string }[] = [
  { find: /^react-native$/, replacement: 'react-native-web' },
  // react-native/Libraries/* -> react-native-web internals ($ exact match)
  ...RNW_LIBRARIES_REMAPS.map(([id, rnwPath]) => ({
    find: new RegExp(`^${id}$`),
    replacement: rnwPath,
  })),
  // Native-only modules with a web mock in the repo.
  {
    find: /^react-native-fast-image$/,
    replacement: fromRoot(
      'development/module-resolver/react-native-fast-image-mock',
    ),
  },
  {
    find: /^react-native-keyboard-controller$/,
    replacement: fromRoot(
      'development/module-resolver/react-native-keyboard-controller-mock',
    ),
  },
  // Native-only, no web counterpart -> empty (rspack sets these to `false`).
  { find: /^react-native-aes-crypto$/, replacement: EMPTY_STUB },
  { find: /^react-native-cloud-fs$/, replacement: EMPTY_STUB },
  // @react-aria: resolve to TS source (Vite compiles TS directly).
  {
    find: /^@react-aria\/focus$/,
    replacement: fromRoot('node_modules/@react-aria/focus/src/index.ts'),
  },
  {
    find: /^@react-aria\/interactions$/,
    replacement: fromRoot('node_modules/@react-aria/interactions/src/index.ts'),
  },
  {
    find: /^@react-aria\/ssr$/,
    replacement: fromRoot('node_modules/@react-aria/ssr/src/index.ts'),
  },
  {
    find: /^@react-aria\/utils$/,
    replacement: fromRoot('node_modules/@react-aria/utils/src/index.ts'),
  },
  // Node polyfills (rspack `fallback`).
  {
    find: /^crypto$/,
    replacement: fromRoot(
      'packages/shared/src/modules3rdParty/cross-crypto/index.js',
    ),
  },
  { find: /^stream$/, replacement: fromRoot('node_modules/stream-browserify') },
  { find: /^buffer$/, replacement: fromRoot('node_modules/buffer') },
  ...NODE_BUILTIN_STUBS.map((m) => ({
    find: new RegExp(`^${m}$`),
    replacement: EMPTY_STUB,
  })),
  { find: /^bn\.js$/, replacement: fromRoot('node_modules/bn.js') },
];

// ---------------------------------------------------------------------------
// Define map — minimal subset of rspack buildDefineMap needed for the web
// runtime. ONEKEY_PLATFORM is the load-bearing one (drives every platformEnv
// read). The rest are empty-string stubs so `process.env.X` never reads
// `undefined` at runtime.
// ---------------------------------------------------------------------------
const EMPTY_ENV_KEYS = [
  'VERSION',
  'BUNDLE_VERSION',
  'BUILD_NUMBER',
  'BUILD_TIME',
  'GITHUB_SHA',
  'WORKFLOW_GITHUB_SHA',
  'EXT_CHANNEL',
  'E2E_MODE',
  'PERF_MONITOR_ENABLED',
  'ENABLE_NATIVE_BACKGROUND_THREAD',
  'ANDROID_CHANNEL',
  'ONEKEY_PROXY',
  'DESKTOP_E2E_MODE',
];

function buildDefines(isDev: boolean): Record<string, string> {
  const defines: Record<string, string> = {
    'process.env.ONEKEY_PLATFORM': JSON.stringify('web'),
    'process.env.NODE_ENV': JSON.stringify(
      isDev ? 'development' : 'production',
    ),
    'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
    'process.env.EXPO_OS': JSON.stringify('web'),
    'process.env.STORYBOOK_ENABLED': JSON.stringify('true'),
    __DEV__: JSON.stringify(isDev),
    global: 'globalThis',
  };
  for (const key of EMPTY_ENV_KEYS) {
    defines[`process.env.${key}`] = JSON.stringify('');
  }
  return defines;
}

// resolve.extensions — rspack web order, minus `.wasm`/`.d.ts` (those must NOT
// be runtime-resolvable under Vite or a `.d.ts` gets executed as a module).
const RESOLVE_EXTENSIONS = [
  '.web.ts',
  '.web.tsx',
  '.web.js',
  '.web.jsx',
  '.web-only.ts',
  '.web-only.tsx',
  '.web-only.mjs',
  '.web-only.js',
  '.web-only.jsx',
  '.web.mjs',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
];
// esbuild (dep pre-bundle) can't resolve `.json` the same way; drop it there.
const ESBUILD_EXTENSIONS = RESOLVE_EXTENSIONS.filter((e) => e !== '.json');

const MAIN_FIELDS = ['browser', 'module', 'main'];

const config: StorybookConfig = {
  framework: {
    name: getAbsolutePath('@storybook/react-native-web-vite'),
    options: {
      // Babel plugins for the framework's react/babel pass:
      // - syntax-decorators (legacy): `@onekeyhq/shared` logger scopes use
      //   method decorators; the production build's babel pass parses raw TS
      //   and needs the *syntax* enabled or it dies on parse. Syntax-only on
      //   purpose: esbuild compiles the decorators later via tsconfig
      //   `experimentalDecorators` (same as dev). The full proposal transform
      //   here would emit an `abstract class` expression that breaks the
      //   downstream react-docgen plugin.
      // - worklets: run over our source so tamagui.config's `Easing` import
      //   (module-eval time) doesn't crash.
      pluginReactOptions: {
        babel: {
          plugins: [
            ['@babel/plugin-syntax-decorators', { legacy: true }],
            'react-native-worklets/plugin',
          ],
        },
      },
    },
  },
  stories: ['../../../packages/components/src/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  core: {
    disableTelemetry: true,
  },
  async viteFinal(viteConfig, { configType }) {
    const { mergeConfig } = await import('vite');
    const { viteCommonjs } = await import('@originjs/vite-plugin-commonjs');
    const isDev = configType !== 'PRODUCTION';
    const defines = buildDefines(isDev);

    const merged = mergeConfig(viteConfig, {
      plugins: [
        // `enforce: 'pre'` so this resolveId beats the framework's broad
        // `react-native` -> `react-native-web` string alias, which array order
        // alone can't reliably win — it rewrites react-native/Libraries/* deep
        // ids into non-existent `react-native-web/Libraries/...` files and
        // crashes the esbuild dep-scan. Ids with a real RNW counterpart fall
        // through (null) to the RNW_LIBRARIES_REMAPS aliases; the rest of the
        // class has no web counterpart and is stubbed. Order-independent: it
        // fires in the dep-optimize scan AND the dev server.
        {
          name: 'onekey-playground-rn-libraries-stub',
          enforce: 'pre' as const,
          resolveId(id: string) {
            if (
              id.startsWith('react-native/Libraries/') &&
              !RNW_REMAPPED_LIBRARY_IDS.has(id)
            ) {
              return EMPTY_STUB;
            }
            return null;
          },
        },
        // Rewrite the two runtime `require()` call sites that Vite's ESM server
        // can't handle: Provider/index.tsx (tamagui.config) and
        // platformEnv.ts (buildTimeEnv.js). Scoped to those two packages.
        viteCommonjs({
          include: ['**/packages/components/**', '**/packages/shared/**'],
        }),
      ],
      define: defines,
      resolve: {
        alias: ONEKEY_ALIASES,
      },
      optimizeDeps: {
        include: [
          'react-native-web',
          'buffer',
          'stream-browserify',
          'react-intl',
          'moti',
          'react-native-svg',
          // Only DialogV2 reaches it, so Vite discovers it mid-session and
          // re-optimizes; the page then mixes chunks from two optimize runs
          // and Base UI sees a second React ("Cannot read properties of null
          // (reading 'useContext')" in DialogRoot). Pre-bundling it up front
          // keeps every chunk on one run.
          '@base-ui/react/dialog',
        ],
        exclude: [
          // RN on-device network devtools — irrelevant to web-only rendering
          // and its deep `react-native/Libraries/WebSocket/WebSocketInterceptor`
          // import crashes the esbuild pre-bundle scan. Keep it out of optimize.
          '@rozenite/network-activity-plugin',
          // Raw TS-source package (`main: ./src/index.tsx`). esbuild pre-bundling
          // mangles its `export enum` named export into a default-only interop
          // ("does not provide an export named 'default'"), which breaks Input.
          // Excluding it lets Vite transform the TS source directly, preserving
          // the named exports.
          '@onekeyfe/react-native-text-input',
        ],
        esbuildOptions: {
          resolveExtensions: ESBUILD_EXTENSIONS,
          mainFields: MAIN_FIELDS,
          loader: { '.js': 'jsx' },
          define: defines,
        },
      },
      server: {
        fs: {
          // @react-aria aliases point at node_modules TS source; allow it.
          allow: [REPO_ROOT],
        },
      },
    });

    // Hard overrides AFTER merge — the RNW-vite framework re-adds `react-native`
    // to resolve.conditions and re-prioritizes mainFields; that makes moti /
    // react-native-svg resolve their raw RN source and blow up. Force the web
    // resolution deterministically here. (mergeConfig returns a plain record;
    // pin it back to the input config type so these writes stay type-checked.)
    const typedMerged = merged as typeof viteConfig;
    const resolve = typedMerged.resolve ?? {};
    resolve.mainFields = MAIN_FIELDS;
    resolve.conditions = (resolve.conditions ?? []).filter(
      (c) => c !== 'react-native',
    );
    resolve.extensions = RESOLVE_EXTENSIONS;
    // resolve.alias needs no override here: mergeConfig's mergeAlias prepends
    // the override aliases (ONEKEY_ALIASES) ahead of the framework's, and Vite
    // uses first match.
    typedMerged.resolve = resolve;

    return typedMerged;
  },
};

export default config;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
