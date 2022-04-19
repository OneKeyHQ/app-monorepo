// eslint-disable-next-line import/order
import './shared-polyfill';

// inject css to dapp web
// import './content-script.css';

import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import devToolsButton from '../content-script/devToolsButton';

console.log('==== injected script tag start >>>>>>>', performance.now());

console.log('[OneKey RN]: Content script works! 333');
console.log('   Must reload extension for modifications to take effect.');

bridgeSetup.contentScript.inject('injected.js');
bridgeSetup.contentScript.setupMessagePort();

if (
  process.env.NODE_ENV !== 'production' &&
  process.env.EXT_INJECT_RELOAD_BUTTON
) {
  setTimeout(() => {
    devToolsButton.inject();
  }, 2000);
}

console.log('==== injected script tag done >>>>>>>', performance.now());

export {};
