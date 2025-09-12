import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

export const exportLogs = async () => {
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(50);
  void globalThis.desktopApiProxy.dev.openLoggerFile();
};
