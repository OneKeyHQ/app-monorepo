// eslint-disable-next-line import/order
import './shared-polyfill';

// inject css to dapp web
// import './content-script.css';

// injected hot-reload cache update:  37824555
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

function shouldInject() {
  const { hostname } = window.location;
  // zhihu search will fail if inject custom code
  const blackList = ['www.zhihu.com', 'zhihu.com'];
  if (blackList.includes(hostname)) {
    return false;
  }
  return true;
}

const removeScriptTagAfterInject = true;

if (shouldInject()) {
  if (platformEnv.isManifestV3) {
    bridgeSetup.contentScript.inject({ file: `injected.js?${Date.now()}` });
  } else {
    // bridgeSetup.contentScript.inject({ file: 'injected.js' });
    bridgeSetup.contentScript.inject({
      code: injectedCode,
      remove: removeScriptTagAfterInject,
    });
  }
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
