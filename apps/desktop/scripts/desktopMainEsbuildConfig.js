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
      ...Object.keys(pkg.dependencies),
    ],
    tsconfig: path.join(electronSource, 'tsconfig.json'),
  };
}

module.exports = { electronSource, getDesktopMainEsbuildResolveOptions };
