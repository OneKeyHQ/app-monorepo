// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable no-inner-declarations */
/* eslint-disable prefer-template */

/* eslint-disable global-require, no-restricted-syntax, import/no-unresolved */
require('./setimmediateShim');

// Promise.allSettled polyfill - must be injected before any code uses it
// Hermes engine may have Promise but lack allSettled on some devices
if (typeof Promise.allSettled !== 'function') {
  console.log('Shims Injected log: Promise.allSettled');
  // Use the promise library's implementation
  const PromisePolyfill = require('promise/setimmediate/es6-extensions');
  Promise.allSettled = PromisePolyfill.allSettled.bind(Promise);
}

require('./intlShim');
const { shim: shimArrayFlatMap } = require('array.prototype.flatmap');

shimArrayFlatMap();

const { shim: shimArrayToSorted } = require('array.prototype.tosorted');

shimArrayToSorted();

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

if (platformEnv.isNative) {
  const useJsBundle =
    require('@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle').useJsBundle();
  if (useJsBundle) {
    const getJsBundlePath =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle').getJsBundlePath;
    const mainBundlePath = getJsBundlePath().split('/main.jsbundle.hbc')[0];
    const assetsPath = `file://${mainBundlePath}/assets/`;

    require('./assetResolutionPatch').patchNativeAssetResolution(assetsPath);
  }
}

// TextEncoder and TextDecoder polyfill for starcoin
// Expo implements TextDecoder but only supports utf8 encoding
if (platformEnv.isNative || typeof TextDecoder === 'undefined') {
  shimsInjectedLog('TextDecoder');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.TextDecoder = require('text-encoding').TextDecoder;
}
// Expo implements TextEncoder but only supports utf8 encoding
if (platformEnv.isNative || typeof TextEncoder === 'undefined') {
  shimsInjectedLog('TextEncoder');
  global.TextEncoder = require('text-encoding').TextEncoder;
}

// Buffer polyfill
if (typeof Buffer === 'undefined') {
  shimsInjectedLog('Buffer');
  // global.Buffer = require('@craftzdog/react-native-buffer').Buffer;
  global.Buffer = require('buffer').Buffer;
}

// patch Buffer.prototype.subarray
if (!(Buffer.alloc(1).subarray(0, 1) instanceof Buffer)) {
  Buffer.prototype.subarray = function subarray() {
    // eslint-disable-next-line prefer-rest-params
    const result = Uint8Array.prototype.subarray.apply(this, arguments);
    Object.setPrototypeOf(result, Buffer.prototype);
    return result;
  };
}

if (!platformEnv.isNative) {
  require('./globalShim');
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
// Import the the ethers shims (**BEFORE** ethers)
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
  } catch (_error) {
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
} catch (_error) {
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

if (platformEnv.isNative) {
  shimsInjectedLog('event-target-polyfill');
  try {
    require('event-target-polyfill');
  } catch (error) {
    console.warn('event-target-polyfill load failed', error);
  }

  if (typeof global.CustomEvent !== 'function' && typeof Event === 'function') {
    global.CustomEvent = function CustomEvent(type, params = {}) {
      const event = new Event(type, params);
      event.detail = params.detail || null;
      return event;
    };
  }

  if (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout !== 'function' &&
    typeof AbortController !== 'undefined'
  ) {
    AbortSignal.timeout = function timeout(delay) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), delay);
      return controller.signal;
    };
  }

  if (!ArrayBuffer.prototype.transfer) {
    // eslint-disable-next-line no-extend-native
    ArrayBuffer.prototype.transfer = function (newByteLength) {
      const length = newByteLength ?? this.byteLength;
      const newBuffer = new ArrayBuffer(length);
      const oldView = new Uint8Array(this);
      const newView = new Uint8Array(newBuffer);
      newView.set(oldView.subarray(0, Math.min(oldView.length, length)));
      Object.defineProperty(this, 'byteLength', { value: 0 });
      return newBuffer;
    };
  }
}

// Polyfill crypto.subtle for React Native
// This must be loaded AFTER the crypto polyfill (line 145-154) because it extends the crypto object.
// Purpose: Enable Supabase Auth PKCE flow to use SHA-256 code_challenge (s256 method)
// instead of falling back to plain method when crypto.subtle is unavailable.
// @see @supabase/auth-js GoTrueClient.ts - checks crypto.subtle.digest for PKCE support
if (platformEnv.isNative) {
  require('@onekeyhq/shared/src/appCrypto/cryptoSubtlePolyfill');
}

console.log('polyfillsPlatform.native shim loaded');
