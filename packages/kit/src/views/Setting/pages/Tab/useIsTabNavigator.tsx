import { useIsWideNativeWindow, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Wide iOS windows (the iPhone Duo inner display) get the iPad sidebar
// layout; their media stays `md` because phone media uses the short side.
export const useIsTabNavigator = () => {
  const { gtMd } = useMedia();
  const isWideNativeWindow = useIsWideNativeWindow();
  return gtMd || isWideNativeWindow;
};

/**
 * The settings layout axes, derived once so every surface agrees:
 * - tab navigator (desktop, wide web, iPad, iPhone Duo inner display):
 *   left sidebar + panes
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
