/* eslint-disable import/order */
import 'core-js/es7/global';
import 'globalthis';
import './globalShim';
import './setimmediateShim';
import './extensionApiShim/extensionApiShim';
import './indexedDBShim/indexedDBShim';
import './xhrShim';

console.log('polyfillsPlatform.ext shim loaded');
