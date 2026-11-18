import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';

import type {
  IGetAppThemeVariant,
  ISetSystemBarsOverride,
  IUpdateAppRootViewBackground,
  IUseAppearanceTheme,
} from './type';

export const useAppearanceTheme: IUseAppearanceTheme = () => {};

// The app theme, recorded from NavigationContainer's root background paint.
// The web image cropper draws over the app and needs it.
let appVariant: 'light' | 'dark' | undefined;

export const getAppThemeVariant: IGetAppThemeVariant = () => appVariant;

/** Native-only: web has no system bars to paint. */
export const setSystemBarsOverride: ISetSystemBarsOverride = () => {};

/** No override layer off native — the app request passes straight
 * through to the platform module (a no-op shim on web). */
export const updateAppRootViewBackground: IUpdateAppRootViewBackground = (
  color,
  themeVariant,
  themeSetting,
) => {
  appVariant = themeVariant;
  updateRootViewBackgroundColor(color, themeVariant, themeSetting);
};
