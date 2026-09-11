/* eslint-disable import-js/order */
import './globalShim';
import './setimmediateShim';
import './requestIdleCallbackShim';
import './extensionApiShim/extensionApiShim';
import './indexedDBShim/indexedDBShim';
import './xhrShim';

console.log('polyfillsPlatform.ext shim loaded');
