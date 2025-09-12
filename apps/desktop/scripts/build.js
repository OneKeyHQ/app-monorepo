require('../../../development/env');

const path = require('path');
const childProcess = require('child_process');
const { build } = require('esbuild');
const glob = require('glob');
const pkg = require('../app/package.json');

const electronSource = path.join(__dirname, '..', 'app');

const gitRevision = childProcess
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

const isProduction = process.env.NODE_ENV === 'production';

const hrstart = process.hrtime();

// Get all .js files in service directory
const serviceFiles = glob
  .sync(path.join(electronSource, 'service', '*.ts'))
  .map((name) => name.split('app/').pop());

build({
  entryPoints: ['app.ts', 'preload.ts', ...serviceFiles].map((f) =>
    path.join(electronSource, f),
  ),
  platform: 'node',
  bundle: true,
  target: 'node16',
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
      '../../desktop/app/libs/react-native-mmkv-mock',
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
  outdir: path.join(__dirname, '..', 'app/dist'),
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development',
    ),
    'process.env.GITHUB_SHA': JSON.stringify(process.env.GITHUB_SHA || ''),
    'process.env.DESK_CHANNEL': JSON.stringify(process.env.DESK_CHANNEL || ''),
    'process.env.COMMITHASH': JSON.stringify(gitRevision),
    'process.env.SENTRY_DSN_EXT': JSON.stringify(
      process.env.SENTRY_DSN_EXT || '',
    ),
    'process.env.SENTRY_DSN_DESKTOP': JSON.stringify(
      process.env.SENTRY_DSN_DESKTOP || '',
    ),
    'process.env.APPIMAGE': JSON.stringify(process.env.APPIMAGE || ''),
    'process.env.SNAP': JSON.stringify(process.env.SNAP || ''),
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
  },
})
  .then(() => {
    const hrend = process.hrtime(hrstart);
    console.log(
      '[Electron Build] Finished in %dms',
      (hrend[1] / 1_000_000 + hrend[0] * 1000).toFixed(1),
    );
  })
  .catch(() => process.exit(1));
