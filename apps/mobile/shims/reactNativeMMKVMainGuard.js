const { OneKeyLocalError } = require('@onekeyhq/shared/src/errors');

function createMMKV() {
  throw new OneKeyLocalError(
    'react-native-mmkv is forbidden in the native main runtime; use the bg storage proxy',
  );
}

module.exports = { createMMKV };
