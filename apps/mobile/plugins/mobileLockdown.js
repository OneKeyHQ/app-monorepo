/* eslint-disable onekey/no-raw-error */
const { createRequire } = require('module');

let adapterPolyfills;

function getMobileLockdownPolyfills() {
  if (!adapterPolyfills) {
    const adapterRequire = createRequire(
      require.resolve('@lavamoat/react-native-lockdown/package.json'),
    );
    adapterPolyfills = [
      adapterRequire.resolve('ses/hermes'),
      adapterRequire.resolve('@lavamoat/react-native-lockdown/repair'),
    ];
  }
  return adapterPolyfills;
}

function isMobileLockdownEnabled(env = process.env) {
  const value = env.ONEKEY_MOBILE_LOCKDOWN;
  if (value !== undefined && value !== 'false' && value !== 'true') {
    throw new Error('ONEKEY_MOBILE_LOCKDOWN must be true or false.');
  }
  return value !== 'false';
}

function getMobileLockdownE2ERunId(env = process.env) {
  const value = env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  if (value === undefined) return '';
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) {
    throw new Error(
      'ONEKEY_MOBILE_LOCKDOWN_E2E must be a 32-character lowercase hex run ID.',
    );
  }
  if (!isMobileLockdownEnabled(env)) {
    throw new Error('Mobile lockdown E2E requires protection to be enabled.');
  }
  if (env.NODE_ENV === 'production') {
    if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(env.VERSION || '')) {
      throw new Error(
        'Mobile lockdown Release E2E requires an explicit VERSION.',
      );
    }
    for (const key of ['BUILD_NUMBER', 'BUNDLE_VERSION']) {
      if (!/^[1-9]\d*$/.test(env[key] || '')) {
        throw new Error(
          `Mobile lockdown Release E2E requires a positive integer ${key}.`,
        );
      }
    }
  }
  return value;
}

function getMobileLockdownWebEmbedCandidateEnabled(env = process.env) {
  const keys = [
    'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_ARTIFACT',
    'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST',
    'ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256',
  ];
  if (keys.every((key) => env[key] === undefined)) return false;
  if (
    env.NODE_ENV !== 'production' ||
    !getMobileLockdownE2ERunId(env) ||
    keys.some((key) => typeof env[key] !== 'string' || !env[key].trim()) ||
    !/^[a-f0-9]{64}$/.test(
      env.ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256,
    )
  ) {
    throw new Error(
      'Protected WebEmbed assets require a Release E2E run and all verified candidate inputs.',
    );
  }
  // prepareCandidateWebEmbed verifies every byte before native assets are copied.
  // This compile-time switch never makes the modern-engine candidate release eligible.
  return true;
}

function mobileLockdownE2EGate() {
  return {
    name: 'mobile-lockdown-e2e-gate',
    visitor: {
      IfStatement(statement, state) {
        if (
          !state.opts.runId &&
          statement
            .get('test')
            .matchesPattern('process.env.ONEKEY_MOBILE_LOCKDOWN_E2E')
        ) {
          // Remove only this explicit test-build guard before Metro collects
          // dependencies, including in development bundles without minification.
          if (statement.node.alternate)
            throw statement.buildCodeFrameError(
              'Mobile lockdown E2E guards must not have an else branch.',
            );
          statement.remove();
        }
      },
    },
  };
}

function applyMobileLockdownConfig(config) {
  const enabled = isMobileLockdownEnabled();
  const e2eRunId = getMobileLockdownE2ERunId();
  const webEmbedCandidate = getMobileLockdownWebEmbedCandidateEnabled();
  const webEmbedKey = webEmbedCandidate
    ? process.env.ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256
    : 'off';
  config.cacheVersion = `${config.cacheVersion || 'default'}:mobile-lockdown-${enabled ? 'on' : 'off'}:e2e-${e2eRunId || 'off'}:webembed-${webEmbedKey}`;
  if (!enabled) return config;

  // Resolve SES from the adapter's dependency tree. The web hardening runtime
  // uses a different SES version and must not be mixed into this realm.
  const adapterRequire = createRequire(
    require.resolve('@lavamoat/react-native-lockdown/package.json'),
  );
  const { assertPolyfills } = adapterRequire('@lavamoat/react-native-lockdown');
  const [sesPath, repairPath] = getMobileLockdownPolyfills();
  const getPolyfills =
    config.serializer.getPolyfills || require('@react-native/js-polyfills');
  const processModuleFilter =
    config.serializer.processModuleFilter || (() => true);

  // The upstream serializer hardens only entry module 0. OneKey's persistent
  // registry never assigns 0, and union/vendor builds serialize several entries.
  // Preserve their serializers and finalize explicitly after the synchronous
  // OneKey polyfills in each entry instead.
  config.serializer = {
    ...config.serializer,
    processModuleFilter(module) {
      if (
        /[\\/]node_modules[\\/]ses[\\/]/.test(module.path) &&
        module.path !== sesPath
      ) {
        throw new Error(
          `Mobile lockdown cannot include a second or vanilla SES module: ${module.path}`,
        );
      }
      return processModuleFilter(module);
    },
    getPolyfills(options) {
      const polyfills = getPolyfills(options);
      assertPolyfills(polyfills);
      return [sesPath, repairPath, ...polyfills];
    },
  };
  return config;
}

module.exports = {
  applyMobileLockdownConfig,
  getMobileLockdownPolyfills,
  getMobileLockdownWebEmbedCandidateEnabled,
  getMobileLockdownE2ERunId,
  mobileLockdownE2EGate,
  isMobileLockdownEnabled,
};
