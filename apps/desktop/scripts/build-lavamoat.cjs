// cspell:ignore lavamoat

const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../../../development/lavamoat/error.cjs');
const {
  createNodeWebpackConfiguration,
  compileNodeWebpack,
} = require('../../../development/lavamoat/node-webpack.cjs');

const { createBuildOptions, entryPoints } = require('./build');
const {
  createTrezorBleStaticRequiresPlugin,
} = require('./lavamoat-sdk-requires.cjs');

const nativeExternals = [
  'electron',
  // This existing lazy require is relative to the emitted app.js, not its source.
  '../../native-modules/apple-auth-macos',
  '@stoprocent/noble',
  '@stoprocent/bluetooth-hci-socket',
  'bufferutil',
  'utf-8-validate',
  '@onekeyfe/electron-mac-icloud',
  'passport-desktop-win32-x64-msvc',
];

const nativeModules = [
  // Keep the existing N-API dispatch loader outside the JS sandbox, but protect
  // passport-desktop's public JavaScript wrapper and dummy implementations.
  'passport-desktop/native',
  'electron-check-biometric-auth-changed/auth-arm64.node',
  'electron-check-biometric-auth-changed/auth-x64.node',
].map((request) => ({ request, file: require.resolve(request) }));

function createConfigurations({
  generatePolicy = false,
  outputPath,
  entryName,
} = {}) {
  const repoRoot = path.resolve(__dirname, '../../..');
  const buildOptions = createBuildOptions();
  buildOptions.plugins = [
    ...buildOptions.plugins,
    createTrezorBleStaticRequiresPlugin(),
  ];
  buildOptions.outdir =
    outputPath || path.join(__dirname, '../app/dist-lavamoat');
  if (entryName && !Object.hasOwn(entryPoints, entryName))
    throw new LavaMoatError(`Unknown Desktop entry: ${entryName}`);
  return Object.entries(entryPoints)
    .filter(([name]) => !entryName || name === entryName)
    .map(([name, entry]) => {
      const target = name === 'preload' ? 'electron-preload' : 'electron-main';
      let policyName = `desktop-services/${name.slice('service/'.length)}`;
      if (name === 'app') policyName = 'desktop-main';
      if (name === 'preload') policyName = 'desktop-preload';
      return createNodeWebpackConfiguration({
        esbuildPath: require.resolve('esbuild'),
        buildOptions,
        context: path.resolve(__dirname, '..'),
        entry,
        filename: `${name}.js`,
        outputPath: buildOptions.outdir,
        policyLocation: path.join(repoRoot, 'lavamoat/webpack', policyName),
        target,
        generatePolicy,
        external: nativeExternals,
        nativeModules,
      });
    });
}

module.exports = { createConfigurations };

if (require.main === module) {
  const args = process.argv.slice(2);
  const generatePolicy = args.includes('--generate-policy');
  const productionOutput = args.includes('--production-output');
  const entryArgument = args.find((arg) => arg.startsWith('--entry='));
  const entryName = entryArgument?.slice('--entry='.length);
  if (
    args.some(
      (arg) =>
        arg !== '--generate-policy' &&
        arg !== '--production-output' &&
        arg !== entryArgument,
    ) ||
    new Set(args).size !== args.length ||
    (entryArgument && !entryName)
  ) {
    throw new LavaMoatError(
      'Expected optional --generate-policy, --production-output and --entry=<name>',
    );
  }
  (async () => {
    for (const configuration of createConfigurations({
      generatePolicy,
      entryName,
      outputPath: productionOutput
        ? path.join(__dirname, '../app/dist')
        : undefined,
    })) {
      const stats = await compileNodeWebpack(configuration);
      if (!generatePolicy && configuration.output.filename === 'app.js') {
        fs.copyFileSync(
          path.join(__dirname, '../app/recovery.html'),
          path.join(configuration.output.path, 'recovery.html'),
        );
      }
      process.stdout.write(
        `${stats.toString({ all: false, warnings: true, timings: true })}\n`,
      );
    }
  })().catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}
