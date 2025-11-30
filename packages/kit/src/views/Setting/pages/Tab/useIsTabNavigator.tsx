import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsTabNavigator = () => {
  const { gtMd } = useMedia();
  const isTabNavigator = !platformEnv.isNative || gtMd;
  return isTabNavigator;
};
