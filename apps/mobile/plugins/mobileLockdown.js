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

function applyMobileLockdownConfig(config) {
  const enabled = isMobileLockdownEnabled();
  config.cacheVersion = `${config.cacheVersion || 'default'}:mobile-lockdown-${enabled ? 'on' : 'off'}`;
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
  isMobileLockdownEnabled,
};
