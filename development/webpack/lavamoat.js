// cspell:ignore LavaMoat LAVAMOAT lavamoat lockdown LOCKDOWN

const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');

const { LavaMoatError } = require('../lavamoat/error.cjs');

const { getLavaMoatStaticShimPath } = require('./build-lavamoat-shims');
const { getLavaMoatWasmPaths } = require('./lavamoat-wasm-loader.cjs');

const repoRoot = path.resolve(__dirname, '../..');
let lavaMoatPluginModule;

const LOCKDOWN_OPTIONS = {
  consoleTaming: 'unsafe',
  errorTaming: 'unsafe',
  stackFiltering: 'verbose',
  overrideTaming: 'severe',
  localeTaming: 'unsafe',
  errorTrapping: 'none',
  reporting: 'none',
};

function envFlag(name) {
  return process.env[name] === '1' || process.env[name] === 'true';
}

function isLavaMoatEnabled() {
  return envFlag('ONEKEY_LAVAMOAT') || isLavaMoatPolicyGeneration();
}

function isLavaMoatPolicyGeneration() {
  return envFlag('ONEKEY_LAVAMOAT_GENERATE_POLICY');
}

function getLavaMoatPlugin() {
  if (!lavaMoatPluginModule) {
    lavaMoatPluginModule = require('@lavamoat/webpack');
  }
  return lavaMoatPluginModule;
}

function createPolicyLocation(parts) {
  return path.join(repoRoot, 'lavamoat', 'webpack', ...parts.filter(Boolean));
}

function runtimeFilePattern(inlineRuntime) {
  if (inlineRuntime === undefined) {
    return /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/;
  }
  if (!['background', 'content-script'].includes(inlineRuntime)) {
    throw new LavaMoatError(
      `Unsupported inline LavaMoat runtime: ${inlineRuntime}`,
    );
  }
  return new RegExp(`^${inlineRuntime}\\.bundle\\.js$`);
}

function createLavaMoatWebpackPlugin({
  basePath,
  configName,
  target,
  runtimeConfigurationPerChunk,
  inlineRuntime,
  readableResourceIds = true,
}) {
  if (!isLavaMoatEnabled()) {
    return undefined;
  }

  const diagnosticsVerbosity = Number.parseInt(
    process.env.ONEKEY_LAVAMOAT_DIAGNOSTICS || '0',
    10,
  );
  const LavaMoatPlugin = getLavaMoatPlugin();
  const pluginOptions = {
    rootDir: basePath,
    policyLocation: createPolicyLocation([target, configName]),
    diagnosticsVerbosity: Number.isFinite(diagnosticsVerbosity)
      ? diagnosticsVerbosity
      : 0,
    generatePolicyOnly: isLavaMoatPolicyGeneration(),
    readableResourceIds,
    runChecks: envFlag('ONEKEY_LAVAMOAT_RUN_CHECKS'),
    // Inline the untouched SES source after minification, before the dedicated
    // runtime executes. Keeping runtime out of main prevents maxSize splitting
    // from renaming the selected asset or injecting SES into multiple chunks.
    // A relative `./lockdown` script without a suffix
    // breaks deep links and can be rejected by strict MIME checks; the upstream
    // runtime skips wrapped modules when SES is missing. Inlining also covers
    // SES with the entry's content hash and SRI.
    inlineLockdown: runtimeFilePattern(inlineRuntime),
    staticShims_experimental: [getLavaMoatStaticShimPath()],
    lockdown:
      target === 'ext'
        ? { ...LOCKDOWN_OPTIONS, evalTaming: 'no-eval' }
        : LOCKDOWN_OPTIONS,
  };

  if (runtimeConfigurationPerChunk) {
    pluginOptions.runtimeConfigurationPerChunk_experimental =
      runtimeConfigurationPerChunk;
  }

  return new LavaMoatPlugin(pluginOptions);
}

function createLavaMoatWebpackValidationPlugin({ inlineRuntime } = {}) {
  if (!isLavaMoatEnabled() || isLavaMoatPolicyGeneration()) {
    return undefined;
  }

  const sesRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const sesSource = fs.readFileSync(sesRequire.resolve('ses'), 'utf8');
  const expectedRuntimeFile = runtimeFilePattern(inlineRuntime);
  return {
    apply(compiler) {
      // Inspect final filenames and source after minification, SRI and hashing.
      // Upstream silently skips protected modules if the SES prelude is absent.
      compiler.hooks.afterCompile.tap(
        'OneKeyLavaMoatRuntimeValidation',
        (compilation) => {
          // HTML templates inherit compiler hooks but are not application runtimes.
          if (compilation.compiler !== compiler) return;
          const runtimes = [...compilation.chunks].filter((chunk) =>
            chunk.hasRuntime(),
          );
          const runtimeFiles = runtimes.flatMap((chunk) =>
            [...chunk.files].filter((file) => file.endsWith('.js')),
          );
          const sesFiles = compilation
            .getAssets()
            .filter(
              ({ name, source }) =>
                name.endsWith('.js') &&
                source.source().toString().includes(sesSource),
            );
          if (
            runtimes.length !== 1 ||
            runtimeFiles.length !== 1 ||
            !expectedRuntimeFile.test(runtimeFiles[0]) ||
            sesFiles.length !== 1 ||
            sesFiles[0].name !== runtimeFiles[0] ||
            sesFiles[0].source.source().toString().split(sesSource).length !== 2
          ) {
            compilation.errors.push(
              new LavaMoatError(
                'Protected builds require exactly one expected runtime containing one untouched SES prelude; check runtimeChunk, output.filename and inlineLockdown.',
              ),
            );
          }
        },
      );
    },
  };
}

function createLavaMoatWebpackOptimization() {
  return isLavaMoatEnabled()
    ? { runtimeChunk: { name: 'lavamoat-runtime' } }
    : {};
}

function createLavaMoatWebpackRules() {
  if (!isLavaMoatEnabled()) {
    return [];
  }

  const LavaMoatPlugin = getLavaMoatPlugin();
  const wasmPaths = getLavaMoatWasmPaths();

  return [
    {
      // These dependencies load the emitted URL at runtime. An explicit raw
      // loader admits only their reviewed binaries; keep hashed asset/resource
      // output and all JavaScript compartment enforcement unchanged.
      include: (resource) => wasmPaths.includes(resource),
      type: 'asset/resource',
      use: [require.resolve('./lavamoat-wasm-loader.cjs')],
    },
    {
      test: /\.css$/,
      use: [LavaMoatPlugin.exclude],
    },
    {
      test: /[\\/]node_modules[\\/]ses[\\/]/,
      use: [LavaMoatPlugin.exclude],
    },
  ];
}

module.exports = {
  createLavaMoatWebpackOptimization,
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackRules,
  createLavaMoatWebpackValidationPlugin,
  isLavaMoatEnabled,
  isLavaMoatPolicyGeneration,
};
