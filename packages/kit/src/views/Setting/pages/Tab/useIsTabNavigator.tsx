import { useIsGtMd } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsTabNavigator = () => {
  const gtMd = useIsGtMd();
  return platformEnv.isNativeIOSPad || gtMd;
};
