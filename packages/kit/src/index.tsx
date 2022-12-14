import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from './background/instance/backgroundApiProxy';

global.$backgroundApiProxy = backgroundApiProxy;

// eslint-disable-next-line global-require
if (platformEnv.isNative) require('react-native-url-polyfill/auto');

export { default as Provider } from './provider';
