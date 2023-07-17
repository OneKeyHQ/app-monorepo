import { format as fnsFormat } from 'date-fns';
import { isArray, isNil } from 'lodash';
import { InteractionManager } from 'react-native';
import { FileLogger, LogLevel } from 'react-native-file-logger';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';
import { zip } from 'react-native-zip-archive';

import platformEnv from '../platformEnv';
import appStorage from '../storage/appStorage';
import { toPlainErrorObject } from '../utils/errorUtils';

import type { transportFunctionType } from 'react-native-logs';

// eslint-disable-next-line import/order
import { stringify } from 'flatted';

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

function countObjectDepth(source: unknown, maxDepth = 5, depth = 0): number {
  const currentDepth = depth + 1;
  if (currentDepth > maxDepth) {
    return currentDepth;
  }

  if (source == null) {
    return currentDepth;
  }

  if (typeof source !== 'object' || typeof source === 'function') {
    return currentDepth;
  }

  if (Array.isArray(source)) {
    return Math.max(
      ...source.map((item) => countObjectDepth(item, maxDepth, currentDepth)),
    );
  }

  const keys = Object.getOwnPropertyNames(source);
  return Math.max(
    ...keys.map((k) =>
      countObjectDepth(
        (source as { [k: string]: unknown })[k],
        maxDepth,
        currentDepth,
      ),
    ),
  );
}

function stringifyLog(...args: any[]) {
  const argsNew = args.map((arg) => {
    if (arg instanceof Error) {
      const error = toPlainErrorObject(arg as any);
      if (process.env.NODE_ENV === 'production') {
        delete error.stack;
      }
      return error;
    }
    return arg as unknown;
  });
  if (process.env.NODE_ENV !== 'production') {
    const maxDepth = 3;
    try {
      argsNew.forEach((arg) => {
        if (countObjectDepth(arg, maxDepth) > maxDepth) {
          console.warn(
            `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
            arg,
          );
        }
      });
    } catch (error) {
      console.warn(
        `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
        argsNew,
      );
    }
  }
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

const NATIVE_LOG_DIR_PATH = `${RNFS.CachesDirectoryPath}/logs`;
const NATIVE_LOG_ZIP_DIR_PATH = `${RNFS.CachesDirectoryPath}/log_zip`;

const removeLogZipDir = async () => {
  const isExist = await RNFS.exists(NATIVE_LOG_ZIP_DIR_PATH);
  if (isExist) {
    await RNFS.unlink(NATIVE_LOG_ZIP_DIR_PATH);
  }
};

const createLogZipDir = async () => {
  await RNFS.mkdir(NATIVE_LOG_ZIP_DIR_PATH);
};

export const getLogZipPath = async (fileName: string) => {
  try {
    await removeLogZipDir();
    await createLogZipDir();
    return await zip(
      NATIVE_LOG_DIR_PATH,
      `${NATIVE_LOG_ZIP_DIR_PATH}/${fileName}`,
    );
  } catch (e) {
    const files = await RNFS.readDir(NATIVE_LOG_DIR_PATH);
    const sortedFiles = files
      .filter((f) => f.name.endsWith('.log'))
      .map((f) => ({
        ...f,
        time: new Date(f.mtime || f.ctime || '').getTime(),
      }))
      .sort((a, b) => b.time - a.time);
    return sortedFiles[0].path;
  }
};

FileLogger.configure({
  captureConsole: false,
  dailyRolling: true,
  maximumFileSize: 1024 * 1024 * 4,
  maximumNumberOfFiles: 7,
  logsDirectory: NATIVE_LOG_DIR_PATH,
  logLevel: LogLevel.Info,
});
const fileAsyncTransport: transportFunctionType = (props) => {
  const { level, rawMsg, extension } = props;
  FileLogger.write(
    level?.severity || LogLevel.Info,
    `${extension || ''} | ${rawMsg as string}`,
  );
};

const NATIVE_TRANSPORT_CONFIG = {
  transport: platformEnv.isDev
    ? [fileAsyncTransport, consoleTransport]
    : [fileAsyncTransport],
  transportOptions: {
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
  native = 'native',
  staking = 'staking',
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
  [LoggerNames.native]: Cache.createLogger(LoggerNames.native),
  [LoggerNames.staking]: Cache.createLogger(LoggerNames.staking),
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
