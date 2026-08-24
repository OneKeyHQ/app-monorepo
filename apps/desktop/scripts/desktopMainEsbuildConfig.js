const path = require('path');

const pkg = require('../app/package.json');

const electronSource = path.join(__dirname, '..', 'app');

// Module-resolution options for the desktop main (Node) esbuild bundle.
//
// Shared between the production build (build.js) and the Native Messaging host
// bundling smoke check (nativeMessagingHostBundle.test.js) so the smoke check
// exercises the exact same alias / external / tsconfig resolution the shipped
// bundle uses. Without a single source of truth, a config drift could let the
// smoke check pass while the real bundle fails to resolve the host branch (or
// vice versa). Only the resolution-relevant options live here; entryPoints,
// outdir, drop and define stay in build.js because they differ per consumer.
function getDesktopMainEsbuildResolveOptions() {
  return {
    platform: 'node',
    bundle: true,
    target: 'node16',
    loader: { '.text-js': 'text' },
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
  };
}

module.exports = { electronSource, getDesktopMainEsbuildResolveOptions };
