import type { FileLogger as FileLoggerClass } from 'react-native-file-logger';

export { LogLevel } from 'react-native-file-logger';
export const FileLogger = {
  configure: () => {},
} as unknown as typeof FileLoggerClass;
