import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsTabNavigator = () => {
  const { gtMd } = useMedia();
  return platformEnv.isNativeIOSPad || gtMd;
};

/**
 * The settings layout axes, derived once so every surface agrees:
 * - tab navigator (desktop, wide web, iPad): left sidebar + panes
 * - mobile layout (phones): card home + pushed pages
 * - neither (extension popup, narrow web): flat list
 * `preferMobileNaming` lets tab layouts and phones use the few intentional
 * alternate labels, while flat layouts keep the canonical title.
 */
export const useSettingsLayout = () => {
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = Boolean(platformEnv.isNative && !isTabNavigator);
  return {
    isTabNavigator,
    isMobileLayout,
    preferMobileNaming: isMobileLayout || isTabNavigator,
  };
};
