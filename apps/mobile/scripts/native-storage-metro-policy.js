const MMKV_PACKAGE = 'react-native-mmkv';

const NODE_MODULES_PATH_PATTERN = /(?:^|[\\/])node_modules(?:[\\/]|$)/u;
const ONEKEY_WORKSPACE_PATH_PATTERN =
  /(?:^|[\\/])node_modules[\\/]@onekeyhq[\\/]/u;

function isMMKVModule(moduleName) {
  return (
    moduleName === MMKV_PACKAGE || moduleName.startsWith(`${MMKV_PACKAGE}/`)
  );
}

function isThirdPartyModuleOrigin(originModulePath) {
  return Boolean(
    originModulePath &&
    NODE_MODULES_PATH_PATTERN.test(originModulePath) &&
    !ONEKEY_WORKSPACE_PATH_PATTERN.test(originModulePath),
  );
}

function getThirdPartyMMKVImportError({ moduleName, originModulePath }) {
  if (
    !isMMKVModule(moduleName) ||
    !isThirdPartyModuleOrigin(originModulePath)
  ) {
    return undefined;
  }
  return `Third-party MMKV import is forbidden in native bundles: ${originModulePath} -> ${moduleName}. Patch the package to use the BG storage proxy.`;
}

module.exports = {
  getThirdPartyMMKVImportError,
  isThirdPartyModuleOrigin,
};
