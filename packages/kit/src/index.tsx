import platformEnv from '@onekeyhq/shared/src/platformEnv';

import './background/instance/backgroundApiProxy';

// eslint-disable-next-line global-require
if (platformEnv.isNative) require('react-native-url-polyfill/auto');

export { default as KitProvider } from './provider/KitProvider';
