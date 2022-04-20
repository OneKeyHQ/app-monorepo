// FIX: Uncaught ReferenceError: global is not defined
import 'core-js/es7/global';

import { isDev, isInjected, isJest } from '../platformEnv';

import createDebug from './debug/index.js';

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

enum LoggerNames {
  http = 'http',
  jsBridge = 'jsBridge',
  webview = 'webview',
  desktopInjected = 'desktopInjected',
  ethereum = 'ethereum', // TODO rename injectedEthereum
  extContentScripts = 'extContentScripts',
  extInjected = 'extInjected',
  backgroundApi = 'backgroundApi',
  walletConnect = 'walletConnect',
  engine = 'engine',
  sendTx = 'sendTx',
}

type Logger = (...args: unknown[]) => void;

export type IDebugLogger = Record<LoggerNames, Logger> & {
  debug: IDebugLoggerModule | null;
};

const Cache = {
  cache: {} as Record<LoggerNames, unknown[][] | undefined>,
  createLogger(name: LoggerNames): Logger {
    return (...args: unknown[]) => {
      if (isJest()) {
        return;
      }
      const calls = this.cache[name];
      if (calls) {
        calls.push(args);
      } else {
        this.cache[name] = [args];
      }
    };
  },
  flush(name: LoggerNames, logger: Logger): void {
    const calls = this.cache[name];
    if (calls) {
      for (const args of calls) {
        logger(...args);
      }
    }
    delete this.cache[name];
  },
};

// https://github.com/debug-js/debug
const debugLogger: IDebugLogger = {
  debug: null,
  [LoggerNames.http]: Cache.createLogger(LoggerNames.http),
  [LoggerNames.jsBridge]: Cache.createLogger(LoggerNames.jsBridge),
  [LoggerNames.webview]: Cache.createLogger(LoggerNames.webview),
  [LoggerNames.desktopInjected]: Cache.createLogger(
    LoggerNames.desktopInjected,
  ),
  [LoggerNames.ethereum]: Cache.createLogger(LoggerNames.ethereum),
  [LoggerNames.extContentScripts]: Cache.createLogger(
    LoggerNames.extContentScripts,
  ),
  [LoggerNames.extInjected]: Cache.createLogger(LoggerNames.extInjected),
  [LoggerNames.backgroundApi]: Cache.createLogger(LoggerNames.backgroundApi),
  [LoggerNames.walletConnect]: Cache.createLogger(LoggerNames.walletConnect),
  [LoggerNames.engine]: Cache.createLogger(LoggerNames.engine),
  [LoggerNames.sendTx]: Cache.createLogger(LoggerNames.sendTx),
};

async function initLoggerAsync() {
  let debug;
  if (process.env.NODE_ENV !== 'production') {
    debug = await createDebug();
    Object.assign(debugLogger, { debug });
  }

  const noop = () => null;
  // override loggers
  for (const key of Object.keys(LoggerNames)) {
    const name = key as LoggerNames;
    debugLogger[name] = debug ? (debug(name) as Logger) : noop;
    // flush cache calls before debugLogger ready
    Cache.flush(name, debugLogger[name]);
  }
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
