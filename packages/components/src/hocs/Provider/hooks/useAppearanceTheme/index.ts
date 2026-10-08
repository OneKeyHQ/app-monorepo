import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';

import type {
  IGetAppThemeVariant,
  ISetSystemBarsOverride,
  IUpdateAppRootViewBackground,
  IUseAppearanceTheme,
} from './type';

export const useAppearanceTheme: IUseAppearanceTheme = () => {};

/** Native-only: nothing off native presents its own UI over the app. */
export const getAppThemeVariant: IGetAppThemeVariant = () => undefined;

/** Native-only: web has no system bars to paint. */
export const setSystemBarsOverride: ISetSystemBarsOverride = () => {};

/** No override layer off native — the app request passes straight
 * through to the platform module (a no-op shim on web). */
export const updateAppRootViewBackground: IUpdateAppRootViewBackground = (
  color,
  themeVariant,
  themeSetting,
) => {
  updateRootViewBackgroundColor(color, themeVariant, themeSetting);
};
