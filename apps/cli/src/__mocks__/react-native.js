// Minimal react-native shim for CLI Jest tests.
// The CLI never uses RN APIs — this prevents Flow syntax parse errors
// when @onekeyhq/shared transitively imports platformEnv.
module.exports = {
  Platform: { OS: 'web', select: (obj) => obj.default || obj.web },
  NativeModules: {},
  NativeEventEmitter: class {},
  Linking: { getInitialURL: () => Promise.resolve(null) },
  AppState: { currentState: 'active' },
};
