import 'react-native-url-polyfill/auto';

// import backgroundApiProxy after third party modules, but before all local modules
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from './background/instance/backgroundApiProxy';

const IGNORED_WARNINGS = [
  'recommended absolute minimum',
  'Easing was renamed to EasingNode',
  'componentWillReceiveProps has been renamed',
  'console.disableYellowBox',
  'NativeBase:',
  'style attribute preprocessor',
  'new NativeEventEmitter',
  'If your state or actions are very large took',
];
const originConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    IGNORED_WARNINGS.some((ignoredWarning) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      args[0].includes(ignoredWarning),
    )
  ) {
    return;
  }
  return originConsoleWarn(...args);
};

if (process.env.NODE_ENV !== 'production') {
  console.log(
    'backgroundApiProxy should init ASAP:',
    // native can not print backgroundApiProxy
    platformEnv.isNative ? {} : backgroundApiProxy,
  );
}

export { default as Provider } from './provider';
