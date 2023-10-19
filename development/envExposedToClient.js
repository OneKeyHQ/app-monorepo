const developmentConsts = require('./developmentConsts');

function buildEnvExposedToClientDangerously({ platform }) {
  // *** ATTENTION: DO NOT expose any sensitive variable here ***
  // ***        like password, secretKey, etc.     ***
  const transformInlineEnvironmentVariables = [
    'NODE_ENV',
    'VERSION',
    'BUILD_NUMBER',
    'ONEKEY_PLATFORM',
    'PUBLIC_URL',
    'EXT_INJECT_RELOAD_BUTTON',
    'EXT_INJECT_MODE',
    'EXT_CHANNEL',
    'ONEKEY_BUILD_TYPE',
    'TAMAGUI_TARGET',
    'ANDROID_CHANNEL',
    'DESK_CHANNEL',
    'COVALENT_KEY',
    'HARDWARE_SDK_CONNECT_SRC',
    'GITHUB_SHA',
    'STORYBOOK_ENABLED',
  ];

  if (platform === developmentConsts.platforms.app) {
    transformInlineEnvironmentVariables.push('JPUSH_KEY');
  }

  return transformInlineEnvironmentVariables;
}

module.exports = {
  buildEnvExposedToClientDangerously,
};
