// FIX: Uncaught ReferenceError: global is not defined
import 'core-js/es7/global';
import * as FileSystem from 'expo-file-system';
import { InteractionManager } from 'react-native';
import {
  logger as RNLogger,
  consoleTransport,
  fileAsyncTransport,
} from 'react-native-logs';
// eslint-disable-next-line import/order
import { stringify } from 'circular-json';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import platformEnv from '../platformEnv';

const LOCAL_WEB_LIKE_TRANSPORT_CONFIG = {
  transport: consoleTransport,
  transportOptions: {
    consoleFunc: (msg: string) => {
      backgroundApiProxy.serviceApp.addLogger(`${msg}\r\n`);
      if (platformEnv.isDev) {
        console.log(msg);
      }
    },
  },
};

const NATIVE_TRANSPORT_CONFIG = {
  transport: fileAsyncTransport,
  transportOptions: {
    FS: FileSystem,
    fileName: 'log.txt',
    filePath: FileSystem.cacheDirectory,
  },
};

export const logger = RNLogger.createLogger({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  stringifyFunc: stringify,
  dateFormat: 'iso',
  ...(platformEnv.isNative
    ? NATIVE_TRANSPORT_CONFIG
    : LOCAL_WEB_LIKE_TRANSPORT_CONFIG),
});

export enum LoggerNames {
  hardwareSDK = 'hardwareSDK',
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
  navigation = 'navigation',
  redux = 'redux',
}

const Cache = {
  createLogger(name: LoggerNames): ReturnType<typeof logger.extend> {
    return logger.extend(name);
  },
};

const debugLogger = {
  [LoggerNames.hardwareSDK]: Cache.createLogger(LoggerNames.hardwareSDK),
  [LoggerNames.redux]: Cache.createLogger(LoggerNames.redux),
  [LoggerNames.navigation]: Cache.createLogger(LoggerNames.navigation),
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

if (platformEnv.isDev) {
  // internal console
  global.$$debugLogger = debugLogger;
}

if (platformEnv.isNative) {
  const removePreviousLogFile = async () => {
    try {
      const filePath = `${FileSystem.cacheDirectory ?? ''}log.txt`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        debugLogger.backgroundApi.info('previous log file deleted at init');
      }
    } catch (e) {
      // ignore
    }
  };
  removePreviousLogFile();
}

export default debugLogger;
