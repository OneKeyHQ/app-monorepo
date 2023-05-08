const developmentConsts = require('./developmentConsts');

function buildEnvExposedToClientDangerously({ platform }) {
  // *** ATTENTION: DO NOT expose any sensitive variable here ***
  // ***        like password, secretKey, etc.     ***
  const transformInlineEnvironmentVariables = [
    'NODE_ENV',
    'VERSION',
    'BUILD_NUMBER',
    'ONEKEY_PLATFORM',
    'EXT_INJECT_MODE',
    'EXT_CHANNEL',
    'ANDROID_CHANNEL',
    'DESK_CHANNEL',
    'COVALENT_KEY',
    'HARDWARE_SDK_CONNECT_SRC',
    'GITHUB_SHA',
  ];

  if (platform === developmentConsts.platforms.app) {
    transformInlineEnvironmentVariables.push('JPUSH_KEY');
  }

  return transformInlineEnvironmentVariables;
}

module.exports = {
  buildEnvExposedToClientDangerously,
};
