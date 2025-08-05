import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import utils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (await import('@onekeyhq/shared/src/modules3rdParty/expo-sharing'))
    .default;
};

export const exportLogs = async (filename: string) => {
  defaultLogger.setting.device.logDeviceInfo();
  await waitAsync(1000);
  const logFilePath = await utils.getLogFilePath(filename);
  console.log('logFilePath', logFilePath);
  const Share = await getShareModule();
  if (!Share) return;
  Share.shareAsync(logFilePath, {
    dialogTitle: 'OneKey Logs',
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
  }).catch(() => {
    /** ignore */
  });
};
