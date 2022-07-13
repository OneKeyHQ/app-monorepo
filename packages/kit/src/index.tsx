import 'react-native-url-polyfill/auto';

// import backgroundApiProxy after third party modules, but before all local modules
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from './background/instance/backgroundApiProxy';

if (process.env.NODE_ENV !== 'production') {
  console.log(
    'backgroundApiProxy should init ASAP:',
    // native can not print backgroundApiProxy
    platformEnv.isNative ? {} : backgroundApiProxy,
  );
}

export { default as Provider } from './provider';
