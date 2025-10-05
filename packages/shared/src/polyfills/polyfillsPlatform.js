/* eslint-disable no-inner-declarations */
/* eslint-disable spellcheck/spell-checker */
/* eslint-disable prefer-template */
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable global-require, no-restricted-syntax, import/no-unresolved */
require('./setimmediateShim');

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

if (platformEnv.isNative) {
  const useJsBundle =
    require('@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle').useJsBundle();
  if (useJsBundle) {
    const getJsBundlePath =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle').getJsBundlePath;
    const mainBundlePath = getJsBundlePath().split('/main.jsbundle.hbc')[0];
    const assetsPath = `file://${mainBundlePath}/assets/`;
    const { Platform, PixelRatio } = require('react-native');
    const AssetSourceResolver =
      require('react-native/Libraries/Image/AssetSourceResolver').default;
    const wrap = require('lodash/wrap');

    const { pickScale } = require('react-native/Libraries/Image/AssetUtils');

    let getAndroidResourceFolderName;
    let getAndroidResourceIdentifier;
    if (Platform.OS === 'android') {
      const pathSupport = require('@react-native/assets-registry/path-support');
      getAndroidResourceFolderName = pathSupport.getAndroidResourceFolderName;
      getAndroidResourceIdentifier = pathSupport.getAndroidResourceIdentifier;
    }

    function getAssetPathInDrawableFolder(asset) {
      const scale = pickScale(asset.scales, PixelRatio.get());
      const drawableFolder = getAndroidResourceFolderName(asset, scale);
      const fileName = getAndroidResourceIdentifier(asset);
      return drawableFolder + '/' + fileName + '.' + asset.type;
    }

    AssetSourceResolver.prototype.defaultAsset = wrap(
      AssetSourceResolver.prototype.defaultAsset,
      function (func, ...args) {
        const defaultLogger =
          require('@onekeyhq/shared/src/logger/logger').defaultLogger;
        defaultLogger.app.error.log(`mainBundlePath: ${mainBundlePath}`);
        const isLoadedFromServer = this.isLoadedFromServer();
        console.log('isLoadedFromServer: ', isLoadedFromServer);
        defaultLogger.app.error.log(
          `isLoadedFromServer: ${isLoadedFromServer}`,
        );
        defaultLogger.app.error.log(`jsBundleUrl: ${this.jsbundleUrl}`);
        if (isLoadedFromServer) {
          const serverUrl = this.assetServerURL();
          console.log('serverUrl: ', serverUrl);
          defaultLogger.app.error.log(`serverUrl: ${serverUrl}`);
          return serverUrl;
        }
        if (Platform.OS === 'android') {
          defaultLogger.app.error.log(`isNativeAndroid start`);
          const isLoadedFromFileSystem = this.isLoadedFromFileSystem();
          defaultLogger.app.error.log(
            `isLoadedFromFileSystem: ${isLoadedFromFileSystem}`,
          );

          if (useJsBundle) {
            defaultLogger.app.error.log(
              `android useJsBundle start`,
              assetsPath,
            );
            const asset = this.fromSource(
              assetsPath + getAssetPathInDrawableFolder(this.asset),
            );
            asset.uri = asset.uri
              .replace('__packages', 'packages')
              .replace('__node_modules', 'node_modules');
            defaultLogger.app.error.log(`android useJsBundle end`, asset.uri);
            return asset;
          }
          if (isLoadedFromFileSystem) {
            const resolvedAssetSource = this.drawableFolderInBundle();
            defaultLogger.app.error.log(
              `resolvedAssetSource: ${resolvedAssetSource.uri}`,
            );
            return resolvedAssetSource;
          }
          const resolvedAssetSource = this.resourceIdentifierWithoutScale();
          defaultLogger.app.error.log(
            `resolvedAssetSource: ${resolvedAssetSource.uri}`,
          );
          return resolvedAssetSource;
        }
        defaultLogger.app.error.log(`Platform.OS: ${Platform.OS}`);
        if (Platform.OS === 'ios') {
          defaultLogger.app.error.log(`iOSAsset start`);
          const iOSAsset = this.scaledAssetURLNearBundle();
          console.log('iOSAsset: ', iOSAsset);
          defaultLogger.app.error.log(`iOSAsset: ${iOSAsset.uri}`);
          defaultLogger.app.error.log(`iOSAsset end`);
          if (useJsBundle) {
            defaultLogger.app.error.log(`useJsBundle start`, assetsPath);
            iOSAsset.uri = iOSAsset.uri
              .replace(this.jsbundleUrl, assetsPath)
              .replace('__packages', 'packages')
              .replace('__node_modules', 'node_modules');
            defaultLogger.app.error.log(`useJsBundle end`, iOSAsset.uri);
          }
          return iOSAsset;
        }
      },
    );
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

console.log('polyfillsPlatform.native shim loaded');
