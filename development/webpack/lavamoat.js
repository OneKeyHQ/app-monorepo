// cspell:ignore LavaMoat LAVAMOAT lavamoat lockdown LOCKDOWN

const path = require('path');

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
  return (
    envFlag('ONEKEY_LAVAMOAT') || envFlag('ONEKEY_LAVAMOAT_GENERATE_POLICY')
  );
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

function createLavaMoatWebpackPlugin({
  basePath,
  configName,
  target,
  runtimeConfigurationPerChunk,
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
    generatePolicyOnly: envFlag('ONEKEY_LAVAMOAT_GENERATE_POLICY'),
    readableResourceIds: true,
    runChecks: envFlag('ONEKEY_LAVAMOAT_RUN_CHECKS'),
    HtmlWebpackPluginInterop: true,
    lockdown: LOCKDOWN_OPTIONS,
  };

  if (runtimeConfigurationPerChunk) {
    pluginOptions.runtimeConfigurationPerChunk_experimental =
      runtimeConfigurationPerChunk;
  }

  return new LavaMoatPlugin(pluginOptions);
}

function createLavaMoatWebpackRules() {
  if (!isLavaMoatEnabled()) {
    return [];
  }

  const LavaMoatPlugin = getLavaMoatPlugin();

  return [
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
  createLavaMoatWebpackPlugin,
  createLavaMoatWebpackRules,
  isLavaMoatEnabled,
};
