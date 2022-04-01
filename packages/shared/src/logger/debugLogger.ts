// FIX: Uncaught ReferenceError: global is not defined
import 'core-js/es7/global';

import { isDev, isInjected, isJest } from '../platformEnv';

import createDebug from './debug/index.js';

// TODO check debugLogger is ready, and wait to execute
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function noop(...args: any[]) {
  if (isJest()) {
    return;
  }
  console.warn('debugLogger not ready yet, fallback to console.log()');
  console.log('[debugLogger]: ', ...args);
}

/*
DEBUG=connect:bodyParser,connect:compress,connect:session
DEBUG=connect:*
DEBUG=*
DEBUG=*,-connect:*

debugLogger.debug.enable('jsBridge,dappProvider');
debugLogger.debug.enable('');
*/

export type IDebugLoggerModule = {
  enable: (ns: string) => void;
  load: () => Promise<string>;
};

export type IDebugLogger = {
  debug?: IDebugLoggerModule | null;
  http: (...args: any[]) => void;
  jsBridge: (...args: any[]) => void;
  webview: (...args: any[]) => void;
  ethereum: (...args: any[]) => void; // TODO rename injectedEthereum
  desktopInjected: (...args: any[]) => void;
  extContentScripts: (...args: any[]) => void;
  extInjected: (...args: any[]) => void;
  backgroundApi: (...args: any[]) => void;
  walletConnect: (...args: any[]) => void;
  engine: (...args: any[]) => void;
  sendTx: (...args: any[]) => void;
};

// https://github.com/debug-js/debug
const debugLogger: IDebugLogger = {
  debug: null,
  http: noop,
  jsBridge: noop,
  webview: noop,
  desktopInjected: noop,
  ethereum: noop,
  extContentScripts: noop,
  extInjected: noop,
  backgroundApi: noop,
  walletConnect: noop,
  engine: noop,
  sendTx: noop,
};

async function initLoggerAsync() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let debug = (name: string) => () => null;
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/await-thenable
    debug = await createDebug();
  }
  Object.assign(debugLogger, {
    debug,
    http: debug('http'),
    jsBridge: debug('jsBridge'),
    webview: debug('webview'),
    desktopInjected: debug('desktopInjected'),
    ethereum: debug('ethereum'),
    extContentScripts: debug('extContentScripts'),
    extInjected: debug('extInjected'),
    backgroundApi: debug('backgroundApi'),
    walletConnect: debug('walletConnect'),
    engine: debug('engine'),
    sendTx: debug('sendTx'),
  });
}

initLoggerAsync();

if (isInjected()) {
  // injected console
  global.$onekey = global.$onekey || {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.$onekey.debugLogger = debugLogger;
} else if (isDev()) {
  // internal console
  global.$$debugLogger = debugLogger;
}

export default debugLogger;
