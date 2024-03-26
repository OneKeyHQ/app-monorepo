/* eslint-disable global-require, no-restricted-syntax, import/no-unresolved */
require('setimmediate');
require('./intlShim');
require('react-native-url-polyfill/auto');
const platformEnv = require('@onekeyhq/shared/src/platformEnv');

const shimsInjectedLog = (str) => console.log(`Shims Injected log: ${str}`);

if (typeof __dirname === 'undefined') global.__dirname = '/';
if (typeof __filename === 'undefined') global.__filename = '';
if (typeof process === 'undefined') {
  shimsInjectedLog('process');
  global.process = require('process');
} else {
  const bProcess = require('process');
  for (const p in bProcess) {
    if (!(p in process)) {
      // @ts-ignore
      process[p] = bProcess[p];
    }
  }
}

// TextEncoder and TextDecoder polyfill for starcoin
if (typeof TextDecoder === 'undefined') {
  shimsInjectedLog('TextDecoder');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.TextDecoder = require('text-encoding').TextDecoder;
}
if (typeof TextEncoder === 'undefined') {
  shimsInjectedLog('TextEncoder');
  global.TextEncoder = require('text-encoding').TextEncoder;
}

// Buffer polyfill
if (typeof Buffer === 'undefined') {
  shimsInjectedLog('Buffer');
  // global.Buffer = require('@craftzdog/react-native-buffer').Buffer;
  global.Buffer = require('buffer').Buffer;
}

// Crypto polyfill

if (typeof crypto === 'undefined') {
  try {
    // check packages/shared/src/modules3rdParty/cross-crypto/verify.ts
    shimsInjectedLog('crypto');
    // eslint-disable-next-line no-const-assign
    global.crypto = require('crypto'); // cross-crypto/index.native.js
  } catch (error) {
    console.error(error);
  }
}

// https://docs.ethers.io/v5/cookbook/react-native/
// Import the crypto getRandomValues shim (**BEFORE** the shims)
// Import the ethers shims (**BEFORE** ethers)
/*
Shims Injected:
  - atob
  - btoa
  - nextTick
  - FileReader.prototype.readAsArrayBuffer
 */
// Shim atob and btoa
// js-base64 lib cannot import by `require` function in React Native 0.72.
const { Base64 } = require('js-base64');

if (!global.atob) {
  shimsInjectedLog('atob');
  global.atob = Base64.atob;
}
if (!global.btoa) {
  shimsInjectedLog('btoa');
  global.btoa = Base64.btoa;
}

// Shim nextTick
if (!global.nextTick) {
  shimsInjectedLog('nextTick');
  global.nextTick = function (callback) {
    setTimeout(callback, 0);
  };
}

// Shim FileReader.readAsArrayBuffer
// https://github.com/facebook/react-native/issues/21209
// can remove after RN 0.72
// https://github.com/facebook/react-native/commit/5b597b5ff94953accc635ed3090186baeecb3873
try {
  const fr = new FileReader();
  try {
    fr.readAsArrayBuffer(new Blob(['hello'], { type: 'text/plain' }));
  } catch (error) {
    shimsInjectedLog('FileReader.prototype.readAsArrayBuffer');
    FileReader.prototype.readAsArrayBuffer = function (blob) {
      if (this.readyState === this.LOADING) {
        throw new Error('InvalidStateError');
      }
      this._setReadyState(this.LOADING);
      this._result = null;
      this._error = null;
      const fr = new FileReader();
      fr.onloadend = () => {
        const content = atob(fr.result.split(',').pop().trim());
        const buffer = new ArrayBuffer(content.length);
        const view = new Uint8Array(buffer);
        view.set(Array.from(content).map((c) => c.charCodeAt(0)));
        this._result = buffer;
        this._setReadyState(this.DONE);
      };
      fr.readAsDataURL(blob);
    };
  }
} catch (error) {
  console.log('Missing FileReader; unsupported platform');
}

if (platformEnv.isNativeAndroid) {
  const shimConsoleLog = (method) => {
    // @ts-ignore
    const originMethod = console[method];
    if (!originMethod) {
      return;
    }
    // @ts-ignore
    console[method] = (...args) => {
      args.forEach((item) => {
        if (item instanceof Error) {
          // sometimes error.stack cause Android hermes engine crash
          delete item.stack;
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      originMethod(...args);
    };
  };
  shimConsoleLog('log');
  shimConsoleLog('info');
  shimConsoleLog('debug');
  shimConsoleLog('warn');
  shimConsoleLog('error');
}

if (platformEnv.isNativeIOS) {
  // typeforce causes iOS to crash.
  Error.captureStackTrace = () => {};
}

console.log('polyfillsPlatform.native shim loaded');
