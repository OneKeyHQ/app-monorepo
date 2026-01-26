import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsTabNavigator = () => {
  const { gtMd } = useMedia();
  return platformEnv.isNativeIOSPad || gtMd;
};
