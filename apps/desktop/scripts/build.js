require('../../../development/env');

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const { build } = require('esbuild');
const glob = require('glob');

const pkg = require('../app/package.json');

const isProduction = process.env.NODE_ENV === 'production';
console.log('building for', isProduction ? 'production' : 'development');
const electronSource = path.join(__dirname, '..', 'app');

const gitRevision = childProcess
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

const hrstart = process.hrtime();

// Perf: keep the ~13MB of per-language translation JSON OUT of the main-process
// bundle (app.js). esbuild has no code-splitting for the CJS/node format, so the
// `() => import('./json/xx.json')` entries in localeJsonMap.ts would otherwise be
// inlined into app.js and fully parsed by V8 on every cold start. Instead we copy
// each locale JSON to `dist/locale-json/` (shipped via baseFiles `dist/**/*`) and
// replace each import with a tiny fs-read shim, so only the ACTIVE locale is read
// (and parsed by Node's fast JSON parser) at runtime. Desktop-main build only —
// localeJsonMap.ts is shared with web/native and is left untouched.
//
// Assumption: these files are read from inside `app.asar` (Electron's asar-aware
// fs handles the path) and are NOT served from a hot-update bundle dir. That is
// correct because JS bundle updates ship renderer assets only; the main-process
// menu/i18n strings here are versioned with the native shell, not the OTA bundle.
// If a future OTA ever needs to update main-process translations, this shim must
// be taught to prefer the active bundle dir before falling back to the asar copy.
const localeJsonOutDir = path.join(__dirname, '..', 'app/dist', 'locale-json');
const externalizeLocaleJsonPlugin = {
  name: 'externalize-locale-json',
  setup(pluginBuild) {
    pluginBuild.onLoad(
      { filter: /[\\/]locale[\\/]json[\\/][^\\/]+\.json$/ },
      (args) => {
        const base = path.basename(args.path);
        fs.mkdirSync(localeJsonOutDir, { recursive: true });
        fs.copyFileSync(args.path, path.join(localeJsonOutDir, base));
        // __dirname resolves to dist/ at runtime (app.js lives in dist/). In a
        // packaged app this is inside app.asar; Electron's fs can read it.
        //
        // Resilience: this shim replaces a previously-inlined JSON module, so a
        // throw here is fatal — `en_US.json` is a STATIC import (eager at app.js
        // eval; a throw kills the main process for every user) and the other 18
        // locales load inside initLocale() (a throw there blocks main-window
        // creation). So we never let a missing/corrupt file escape: fall back to
        // en_US.json, then to an empty object (keys render raw, app still boots).
        const contents = `const fs = require('fs');
const path = require('path');
function readLocaleJson(name) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'locale-json', name), 'utf8'),
  );
}
const __localeFile = ${JSON.stringify(base)};
let __localeData;
try {
  __localeData = readLocaleJson(__localeFile);
} catch (err) {
  console.error('[locale-shim] failed to load ' + __localeFile, err);
  try {
    __localeData = __localeFile === 'en_US.json' ? {} : readLocaleJson('en_US.json');
  } catch (fallbackErr) {
    console.error('[locale-shim] en_US.json fallback also failed', fallbackErr);
    __localeData = {};
  }
}
module.exports = __localeData;
`;
        return { contents, loader: 'js' };
      },
    );
  },
};

// Get all .js files in service directory
const serviceFiles = glob
  .sync(path.join(electronSource, 'service', '*.ts'))
  .map((name) => name.split('app/').pop());

console.log('process.env.NODE_ENV', process.env.NODE_ENV);
console.log('process.env.DESK_CHANNEL', process.env.DESK_CHANNEL);
console.log('process.env.COMMITHASH', process.env.COMMITHASH);
console.log('process.env.SNAP', process.env.SNAP);
console.log('process.env.FLATPAK', process.env.FLATPAK);
console.log('process.env.BUILD_NUMBER', process.env.BUILD_NUMBER);
console.log('process.env.BUILD_TIME', process.env.BUILD_TIME);
console.log('process.env.VERSION', process.env.VERSION);
console.log('process.env.BUNDLE_VERSION', process.env.BUNDLE_VERSION);
console.log('process.env.GITHUB_SHA', process.env.GITHUB_SHA);
build({
  entryPoints: ['app.ts', 'preload.ts', ...serviceFiles].map((f) =>
    path.join(electronSource, f),
  ),
  platform: 'node',
  bundle: true,
  target: 'node16',
  metafile: !!process.env.ESBUILD_METAFILE,
  plugins: [externalizeLocaleJsonPlugin],
  loader: { '.text-js': 'text' },
  drop: isProduction ? ['console', 'debugger'] : [],
  // Help esbuild locate missing dependencies.
  alias: {
    '@onekeyhq/shared': path.join(__dirname, '../../../packages/shared'),
    'react-native': path.join(
      __dirname,
      '../../desktop/app/libs/react-native-mock',
    ),
    '@react-native-async-storage/async-storage': path.join(
      __dirname,
      '../../desktop/app/libs/react-native-async-storage-mock',
    ),
    'react-native-mmkv': path.join(
      __dirname,
      '../../desktop/app/libs/react-native-mmkv-desktop-main',
    ),
    '@sentry/react-native': path.join(
      __dirname,
      '../../desktop/app/libs/sentry-react-native-mock',
    ),
    'react-native-uuid': path.join(
      __dirname,
      '../../../node_modules/react-native-uuid/dist',
    ),
    'axios': path.join(
      __dirname,
      '../../../node_modules/axios/dist/esm/axios.js',
    ),
  },
  external: [
    'electron',
    '@stoprocent/noble',
    '@stoprocent/bluetooth-hci-socket',
    'bufferutil',
    'utf-8-validate',
    // Perf: keep these heavy, non-critical deps OUT of app.js so V8 does not
    // parse them on every cold start. They are shipped as node_modules inside
    // the asar (see app/package.json dependencies) and required on demand.
    // @sentry/electron (~4.3MB) pulls the whole Sentry Node SDK + OpenTelemetry
    // backend instrumentations; systeminformation/iconv-lite are only needed for
    // specific, non-boot-critical features.
    '@sentry/electron',
    'systeminformation',
    'iconv-lite',
    // Tier 1: post-boot only (auto-update + archive extraction) — pulled via the
    // kit-bg desktopApi surface; keep their subtrees (builder-util-runtime, the
    // XML stack, js-yaml) out of app.js parse.
    'electron-updater',
    'adm-zip',
    // Tier 2: large lookup-table deps reached transitively via node-fetch /
    // whatwg-url (tr46 IDNA table) and the local HTTP server (mime-db, validator).
    // FOOTGUN: these three are *transitive* — no app code imports them directly.
    // esbuild leaves a bare `require('<name>')` and only ONE copy ships in the
    // asar, so the shipped version is whatever is pinned in app/package.json, NOT
    // what yarn.lock resolves for the real consumers. When bumping node-fetch /
    // whatwg-url / the http stack, re-check that these pins still match the
    // resolved transitive versions, or the asar will ship a mismatched copy.
    'tr46',
    'mime-db',
    'validator',
    ...Object.keys(pkg.dependencies),
  ],
  tsconfig: path.join(electronSource, 'tsconfig.json'),
  outdir: path.join(__dirname, '..', 'app/dist'),
  define: {
    'process.env.VERSION': JSON.stringify(process.env.VERSION || '1.0.0'),
    'process.env.BUILD_NUMBER': JSON.stringify(process.env.BUILD_NUMBER || '1'),
    'process.env.BUNDLE_VERSION': JSON.stringify(
      // Sentinel '0' marks "CI did not inject BUNDLE_VERSION here";
      // matches the iOS Info.plist sentinel and the Android Gradle
      // defEnvStr fallback so leaks land in a single recognizable
      // mixpanel bucket instead of the legacy '1' that collides with
      // the JS-side `?? '1'` fallback.
      process.env.BUNDLE_VERSION || '0',
    ),
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development',
    ),
    'process.env.GITHUB_SHA': JSON.stringify(process.env.GITHUB_SHA || ''),
    'process.env.DESK_CHANNEL': JSON.stringify(process.env.DESK_CHANNEL || ''),
    'process.env.COMMITHASH': JSON.stringify(gitRevision),
    'process.env.PERF_MONITOR_ENABLED': JSON.stringify(
      process.env.PERF_MONITOR_ENABLED || '',
    ),
    'process.env.SENTRY_DSN_EXT': JSON.stringify(
      process.env.SENTRY_DSN_EXT || '',
    ),
    'process.env.SENTRY_DSN_DESKTOP': JSON.stringify(
      process.env.SENTRY_DSN_DESKTOP || '',
    ),
    // APPIMAGE is intentionally NOT defined here. It is a runtime env set by
    // the AppImage launcher and read (via bracket notation) by electron-updater
    // and our canAutoInstallAppImage guard. AppImage BUILD detection is done
    // via DESK_CHANNEL=appImage instead (see release-desktop-all.yml).
    'process.env.SNAP': JSON.stringify(process.env.SNAP || ''),
    'process.env.FLATPAK': JSON.stringify(process.env.FLATPAK || ''),
    'process.env.SENTRY_DSN_MAS': JSON.stringify(
      process.env.SENTRY_DSN_MAS || '',
    ),
    'process.env.SENTRY_DSN_SNAP': JSON.stringify(
      process.env.SENTRY_DSN_SNAP || '',
    ),
    'process.env.SENTRY_DSN_WINMS': JSON.stringify(
      process.env.SENTRY_DSN_WINMS || '',
    ),
    'process.env.SENTRY_DSN_REACT_NATIVE': JSON.stringify(
      process.env.SENTRY_DSN_REACT_NATIVE || '',
    ),
    'process.env.ONEKEY_PLATFORM': JSON.stringify('desktop'),
    'process.env.SENTRY_DSN_WEB': JSON.stringify(
      process.env.SENTRY_DSN_WEB || '',
    ),
    'process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION': JSON.stringify(
      (
        process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION
          ? process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true'
          : process.env.NODE_ENV !== 'production'
      )
        ? 'true'
        : 'false',
    ),
  },
})
  .then((result) => {
    // Copy static assets (recovery.html) to dist
    if (result && result.metafile) {
      fs.writeFileSync(
        path.join(__dirname, '..', 'app/dist', 'meta.json'),
        JSON.stringify(result.metafile),
      );
      console.log('[Electron Build] Wrote metafile');
    }
    const recoveryHtmlSrc = path.join(electronSource, 'recovery.html');
    const recoveryHtmlDst = path.join(
      __dirname,
      '..',
      'app/dist',
      'recovery.html',
    );
    if (fs.existsSync(recoveryHtmlSrc)) {
      fs.copyFileSync(recoveryHtmlSrc, recoveryHtmlDst);
      console.log('[Electron Build] Copied recovery.html to dist');
    }
    const hrend = process.hrtime(hrstart);
    console.log(
      '[Electron Build] Finished in %dms',
      (hrend[1] / 1_000_000 + hrend[0] * 1000).toFixed(1),
    );
  })
  .catch(() => process.exit(1));
