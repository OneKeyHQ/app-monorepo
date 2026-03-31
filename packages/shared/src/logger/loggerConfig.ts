import {
  LoggerConfigManager,
  createLoggerConfigFacade,
} from './config/loggerConfigManager';

export type { ILoggerConfig } from './config/loggerConfigShared';

const loggerConfig = new LoggerConfigManager();
void loggerConfig.init();
const defaultLoggerConfig = createLoggerConfigFacade(loggerConfig);

export { defaultLoggerConfig, loggerConfig, LoggerConfigManager };
