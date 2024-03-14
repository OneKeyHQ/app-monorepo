import {
  FileLogger,
  LogLevel,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

const NATIVE_LOG_DIR_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs`;

void FileLogger.configure({
  captureConsole: false,
  dailyRolling: true,
  formatter: (_, msg: string) => msg,
  maximumFileSize: 1024 * 1024 * 4, // 4MB
  maximumNumberOfFiles: 7,
  logsDirectory: NATIVE_LOG_DIR_PATH,
  logLevel: LogLevel.Info,
});

export const consoleFunc = (msg: string) => {
  console.log(msg);
  FileLogger.write(LogLevel.Info, msg);
};

export const getLogFilePaths = async () => {
  const filePaths = await FileLogger.getLogFilePaths();
  return filePaths;
};
