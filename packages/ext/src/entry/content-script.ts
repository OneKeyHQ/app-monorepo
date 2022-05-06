// eslint-disable-next-line import/order
import './shared-polyfill';

// inject css to dapp web
// import './content-script.css';

import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import devToolsButton from '../content-script/devToolsButton';

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import injectedCode from './injected.text-js';

if (process.env.NODE_ENV !== 'production') {
  console.log('==== injected script tag start >>>>>>>', performance.now());
  console.log('[OneKey RN]: Content script works! ');
  console.log('   Must reload extension for modifications to take effect.');
}

const removeScriptTagAfterInject = true;
if (platformEnv.isManifestV3) {
  bridgeSetup.contentScript.inject({ file: 'injected.js' });
} else {
  // bridgeSetup.contentScript.inject({ file: 'injected.js' });
  bridgeSetup.contentScript.inject({
    code: injectedCode,
    remove: removeScriptTagAfterInject,
  });
}
bridgeSetup.contentScript.setupMessagePort();

if (
  process.env.NODE_ENV !== 'production' &&
  process.env.EXT_INJECT_RELOAD_BUTTON
) {
  setTimeout(() => {
    devToolsButton.inject();
  }, 2000);
}

if (process.env.NODE_ENV !== 'production') {
  console.log('==== injected script tag done >>>>>>>', performance.now());
}

export {};
