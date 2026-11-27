// cspell:ignore lavamoat

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  createNodeWebpackConfiguration,
  compileNodeWebpack,
} = require('../../development/lavamoat/node-webpack.cjs');

const { createBuildOptions } = require('./esbuild.config');
const {
  assertNoDeprecatedBufferConstructors,
} = require('./scripts/assert-no-deprecated-buffer');

function createNativeKeyringParserRule() {
  const adapter = fs.realpathSync(
    path.join(
      __dirname,
      'src/infra/secure-storage/secure-storage.napi-rs-keyring.ts',
    ),
  );
  return {
    // realResource ignores source-controlled matchResource and must match exactly.
    realResource: (resource) => resource === adapter,
    // The trusted first-party adapter loads the signed SEA asset at runtime.
    // Webpack cannot statically evaluate its process.execPath-dependent require.
    parser: { createRequire: false },
  };
}

function createConfiguration({ generatePolicy = false, outputPath } = {}) {
  const repoRoot = path.resolve(__dirname, '../..');
  const configuration = createNodeWebpackConfiguration({
    esbuildPath: require.resolve('esbuild'),
    buildOptions: createBuildOptions({ watch: false }),
    context: __dirname,
    entry: path.join(__dirname, 'src/cli.ts'),
    filename: 'cli.js',
    outputPath: outputPath || path.join(__dirname, 'dist-lavamoat'),
    policyLocation: path.join(repoRoot, 'lavamoat/webpack/cli'),
    generatePolicy,
  });
  configuration.module.rules.push(createNativeKeyringParserRule());
  return configuration;
}

module.exports = { createConfiguration, createNativeKeyringParserRule };

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      'generate-policy': { type: 'boolean' },
      'production-output': { type: 'boolean' },
    },
    strict: true,
  });
  const generatePolicy = values['generate-policy'] === true;
  const configuration = createConfiguration({
    generatePolicy,
    outputPath: values['production-output']
      ? path.join(__dirname, 'dist')
      : undefined,
  });
  compileNodeWebpack(configuration)
    .then((stats) => {
      if (!generatePolicy) {
        assertNoDeprecatedBufferConstructors(
          path.join(configuration.output.path, 'cli.js'),
        );
      }
      process.stdout.write(
        `${stats.toString({ all: false, warnings: true, timings: true })}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.stack}\n`);
      process.exitCode = 1;
    });
}
