// check  polyfillsPlatform.ext.ts  or   polyfillsPlatform.native.js
import './setimmediateShim';
import './globalShim';
import './indexedDBShim/indexedDBShim';

if (process.env.NODE_ENV !== 'production') {
   global.$RefreshReg$ = global.$RefreshReg$ ?? (()=>{});
   global.$RefreshSig$ = global.$RefreshSig$ ?? (()=>(type)=>type);
}
