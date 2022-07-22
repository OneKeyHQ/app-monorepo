import platformEnv from '@onekeyhq/shared/src/platformEnv';
if (platformEnv.isNative) require('react-native-url-polyfill/auto');

import './background/instance/backgroundApiProxy';

export { default as Provider } from './provider';
