import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';

import type {
  ISetSystemBarsOverride,
  IUpdateAppRootViewBackground,
  IUseAppearanceTheme,
} from './type';

export const useAppearanceTheme: IUseAppearanceTheme = () => {};

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
