/* eslint-disable global-require, no-restricted-syntax, import/no-unresolved */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

if (typeof __dirname === 'undefined') global.__dirname = '/';
if (typeof __filename === 'undefined') global.__filename = '';
if (typeof process === 'undefined') {
  global.process = require('process');
} else {
  const bProcess = require('process');
  for (const p in bProcess) {
    if (!(p in process)) {
      process[p] = bProcess[p];
    }
  }
}

// TextEncoder and TextDecoder polyfill for starcoin
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('text-encoding').TextDecoder;
}
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('text-encoding').TextEncoder;
}

// Buffer polyfill
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer;

// Crypto polyfill
if (typeof crypto === 'undefined') global.crypto = require('crypto');

if (platformEnv.isNativeAndroid) {
  const consoleLog = console.log;
  const shimConsoleLog = (method) => {
    const originMethod = console[method];
    if (!originMethod) {
      return;
    }
    console[method] = (...args) => {
      if (process.env.NODE_ENV !== 'production') {
        // consoleLog(`android console.${method} shim`);
      }
      args.forEach((item) => {
        if (item instanceof Error) {
          // sometimes error.stack cause Android hermes engine crash
          delete item.stack;
        }
      });
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
