import { format as fnsFormat } from 'date-fns';
import { isArray, isNil } from 'lodash';
import { InteractionManager } from 'react-native';
import {
  logger as RNLogger,
  consoleTransport,
  fileAsyncTransport,
} from 'react-native-logs';
// eslint-disable-next-line import/order
import { stringify } from 'flatted';

import platformEnv from '../platformEnv';
import appStorage from '../storage/appStorage';
import { toPlainErrorObject } from '../utils/errorUtils';

const RNFS: typeof import('react-native-fs') = platformEnv.isNative
  ? require('react-native-fs')
  : {};

type IConsoleFuncProps = {
  msg: any;
  rawMsg: any;
  level: { severity: number; text: string };
  extension?: string | null;
  options?: any;
};

const LOG_STRING_LIMIT = 500;

function stringifyLog(...args: any[]) {
  const argsNew = args.map((arg) => {
    if (arg instanceof Error) {
      const error = toPlainErrorObject(arg as any);
      delete error.stack;
      return error;
    }
    return arg as unknown;
  });
  const stringifiedLog =
    // @ts-ignore
    stringify(...argsNew);
  return platformEnv.isDev && stringifiedLog.length > LOG_STRING_LIMIT
    ? `${stringifiedLog.slice(0, LOG_STRING_LIMIT)}...`
    : stringifiedLog;
}

function logToConsole(props: IConsoleFuncProps) {
  if (platformEnv.isJest) {
    return;
  }
  if (platformEnv.isDev) {
    const prefix = `${[
      fnsFormat(new Date(), 'HH:mm:ss.SSS'),
      props?.extension || '',
      props?.level?.text || '',
    ]
      .filter(Boolean)
      .join(' | ')} : `;
    let logContent = [prefix];
    if (props?.rawMsg && isArray(props.rawMsg)) {
      logContent = [...logContent, ...props.rawMsg];
    }
    if (props?.level?.text === 'error') {
      console.error(...logContent);
    } else {
      console.log(...logContent);
    }
  }
}

const LOCAL_WEB_LIKE_TRANSPORT_CONFIG = {
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc: (msg: string, props: IConsoleFuncProps) => {
      logToConsole(props);
      global.$backgroundApiProxy?.serviceApp?.addLogger?.(`${msg}\r\n`);
    },
  },
};

const NATIVE_TRANSPORT_CONFIG = {
  transport: platformEnv.isDev
    ? [fileAsyncTransport, consoleTransport]
    : [fileAsyncTransport],
  transportOptions: {
    FS: RNFS,
    fileName: 'log.txt',
    filePath: RNFS.CachesDirectoryPath,
    consoleFunc: (msg: string, props: IConsoleFuncProps) => {
      if (platformEnv.isDev) {
        logToConsole(props);
        global.$backgroundApiProxy?.serviceApp?.addLogger?.(`${msg}\r\n`);
      }
    },
  },
};

export const logger = RNLogger.createLogger({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  stringifyFunc: stringifyLog,
  dateFormat: 'iso',
  ...(platformEnv.isNative
    ? NATIVE_TRANSPORT_CONFIG
    : LOCAL_WEB_LIKE_TRANSPORT_CONFIG),
});

export enum LoggerNames {
  onBoarding = 'onBoarding',
  hardwareSDK = 'hardwareSDK',
  http = 'http',
  jsBridge = 'jsBridge',
  webview = 'webview',
  desktopInjected = 'desktopInjected',
  ethereum = 'ethereum', // TODO rename injectedEthereum
  dappApprove = 'dappApprove', // TODO rename injectedEthereum
  extContentScripts = 'extContentScripts',
  extInjected = 'extInjected',
  backgroundApi = 'backgroundApi',
  walletConnect = 'walletConnect',
  deepLink = 'deepLink',
  accountSelector = 'accountSelector',
  engine = 'engine',
  sendTx = 'sendTx',
  navigation = 'navigation',
  redux = 'redux',
  common = 'common',
  cloudBackup = 'cloudBackup',
  swap = 'swap',
  providerApi = 'providerApi',
  notification = 'notification',
  autoUpdate = 'autoUpdate',
  migrate = 'migrate',
  onekeyLite = 'onekeyLite',
  overview = 'overview',
}

export type LoggerEntity = {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

const Cache = {
  createLogger(name: LoggerNames): LoggerEntity {
    return logger.extend(name) as LoggerEntity;
  },
};

const debugLogger: Record<
  LoggerNames,
  ReturnType<typeof Cache.createLogger>
> = {
  // @ts-ignore
  stringifyLog,
  [LoggerNames.hardwareSDK]: Cache.createLogger(LoggerNames.hardwareSDK),
  [LoggerNames.onBoarding]: Cache.createLogger(LoggerNames.onBoarding),
  [LoggerNames.redux]: Cache.createLogger(LoggerNames.redux),
  [LoggerNames.navigation]: Cache.createLogger(LoggerNames.navigation),
  [LoggerNames.http]: Cache.createLogger(LoggerNames.http),
  [LoggerNames.jsBridge]: Cache.createLogger(LoggerNames.jsBridge),
  [LoggerNames.webview]: Cache.createLogger(LoggerNames.webview),
  [LoggerNames.desktopInjected]: Cache.createLogger(
    LoggerNames.desktopInjected,
  ),
  [LoggerNames.ethereum]: Cache.createLogger(LoggerNames.ethereum),
  [LoggerNames.dappApprove]: Cache.createLogger(LoggerNames.dappApprove),
  [LoggerNames.extContentScripts]: Cache.createLogger(
    LoggerNames.extContentScripts,
  ),
  [LoggerNames.extInjected]: Cache.createLogger(LoggerNames.extInjected),
  [LoggerNames.backgroundApi]: Cache.createLogger(LoggerNames.backgroundApi),
  [LoggerNames.walletConnect]: Cache.createLogger(LoggerNames.walletConnect),
  [LoggerNames.deepLink]: Cache.createLogger(LoggerNames.deepLink),
  [LoggerNames.accountSelector]: Cache.createLogger(
    LoggerNames.accountSelector,
  ),
  [LoggerNames.engine]: Cache.createLogger(LoggerNames.engine),
  [LoggerNames.sendTx]: Cache.createLogger(LoggerNames.sendTx),
  [LoggerNames.common]: Cache.createLogger(LoggerNames.common),
  [LoggerNames.cloudBackup]: Cache.createLogger(LoggerNames.cloudBackup),
  [LoggerNames.swap]: Cache.createLogger(LoggerNames.swap),
  [LoggerNames.providerApi]: Cache.createLogger(LoggerNames.providerApi),
  [LoggerNames.notification]: Cache.createLogger(LoggerNames.notification),
  [LoggerNames.autoUpdate]: Cache.createLogger(LoggerNames.autoUpdate),
  [LoggerNames.migrate]: Cache.createLogger(LoggerNames.migrate),
  [LoggerNames.onekeyLite]: Cache.createLogger(LoggerNames.onekeyLite),
  [LoggerNames.overview]: Cache.createLogger(LoggerNames.overview),
};

if (platformEnv.isDev) {
  // internal console
  global.$$debugLogger = debugLogger;
}

if (platformEnv.isNative) {
  const removePreviousLogFile = async () => {
    try {
      const filePath = `${RNFS.CachesDirectoryPath ?? ''}log.txt`;
      await RNFS.unlink(filePath);
      debugLogger.backgroundApi.info('previous log file deleted at init');
    } catch (e) {
      // ignore
    }
  };
  removePreviousLogFile();
}

const DEBUG_LOGGER_STORAGE_KEY = '$$ONEKEY_DEBUG_LOGGER';

const shouldUseLocalStorage =
  platformEnv.isDesktop ||
  platformEnv.isWeb ||
  platformEnv.isJest ||
  platformEnv.isExtensionOffscreen; // offscreen can't access chrome extension storage

async function getDebugLoggerSettings(): Promise<string | undefined | null> {
  if (shouldUseLocalStorage) {
    return window.localStorage.getItem(DEBUG_LOGGER_STORAGE_KEY);
  }
  return appStorage.getItem(DEBUG_LOGGER_STORAGE_KEY);
}

async function loadDebugLoggerSettings() {
  if (platformEnv.isJest) {
    return;
  }
  const enabledKeysStr = await getDebugLoggerSettings();
  let enabledKeys: string[] = [];
  if (isNil(enabledKeysStr)) {
    enabledKeys = [LoggerNames.common];
  } else {
    enabledKeys = enabledKeysStr.split(',').filter(Boolean);
  }

  Object.keys(LoggerNames).forEach((key) => {
    if (platformEnv.isDev && !enabledKeys.includes(key)) {
      // should enabled() first to create _enabledExtensions array,
      //    otherwise logger.enable() logger.disable() won't working.
      logger.enable(key);
      logger.disable(key);
    } else {
      logger.enable(key);
    }
  });
}

async function saveDebugLoggerSettings() {
  if (platformEnv.isJest) {
    return;
  }
  const enabledKeys: string[] = (logger._enabledExtensions as any) || [];
  const enabledKeysStr = enabledKeys.join(',');
  if (shouldUseLocalStorage) {
    window.localStorage.setItem(DEBUG_LOGGER_STORAGE_KEY, enabledKeysStr);
  } else {
    await appStorage.setItem(DEBUG_LOGGER_STORAGE_KEY, enabledKeysStr);
  }
}

if (platformEnv.isDev && !platformEnv.isJest) {
  loadDebugLoggerSettings().then(() => saveDebugLoggerSettings());
}

// debugLogger.common.error(new Error('Log Sample Error in debugLogger'));

export {
  saveDebugLoggerSettings,
  loadDebugLoggerSettings,
  getDebugLoggerSettings,
};
export default debugLogger;
