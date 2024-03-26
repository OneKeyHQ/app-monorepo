import { getLogFilePath } from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

export const exportLogs = async (filename: string) => {
  const logFilePath = await getLogFilePath(filename);
  const Share = await getShareModule();
  if (!Share) return;
  Share.open({
    url: logFilePath,
    title: 'OneKey Logs',
    filename: `${filename}.zip`,
  }).catch(() => {
    /** ignore */
  });
};
