// inject css to dapp web
// import './content-script.css';

import inpageContentScript from '@onekeyhq/inpage-provider/src/extension/contentScript';
import devToolsButton from '../content-script/devToolsButton';

console.log('[OneKey RN]: Content script works! 222');
console.log('   Must reload extension for modifications to take effect.');

if (process.env.NODE_ENV !== 'production') {
  devToolsButton.inject();
}

inpageContentScript.inject('injected.js');
inpageContentScript.setupMessagePort();

export {};
