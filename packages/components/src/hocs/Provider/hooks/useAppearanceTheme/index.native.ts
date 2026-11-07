import { useLayoutEffect } from 'react';

import { setStyle } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IGetAppThemeVariant,
  ISetSystemBarsOverride,
  ISystemBarsOverride,
  IUpdateAppRootViewBackground,
  IUseAppearanceTheme,
} from './type';

const appGround = (variant: 'light' | 'dark'): string =>
  getTokenValue(
    variant === 'dark' ? '$bgAppDark' : '$bgAppLight',
    'color',
  ) as string;

const setDarkContent = (_color?: string, isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    setStyle('light');
  }
};

const setLightContent = (_color?: string, isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    setStyle('dark');
  }
};

// The system chrome's writers, one effective value: the app theme
// underneath, and a foreground surface's pin on top (onboarding locks
// its content dark while the app theme usually is not — the iOS 26
// glass header's problem shape, solved the same way). Every writer
// repaints through applySystemBars, so ordering can never leave a
// stale coat.
//
// The app runs edge-to-edge on every Android version (KeyboardProvider
// turns off decorFitsSystemWindows and insets the content), so the "bars"
// are transparent over the WINDOW background and the window paint below is
// what colors the bands. The calls above only pick the icon styles.
let appVariant: 'light' | 'dark' | undefined;
// One slot per foreground surface (onboarding, the mobile browser...), so one
// surface releasing its pin can't clear another's; the latest set wins.
const overrides = new Map<string, ISystemBarsOverride>();
const getOverride = () => {
  let latest: ISystemBarsOverride | undefined;
  overrides.forEach((value) => {
    latest = value;
  });
  return latest;
};
// The app's own window-background request (NavigationContainer keeps it
// on the app theme), replayed on override release.
let appRootViewBackground:
  | {
      color: string;
      themeVariant: 'light' | 'dark';
      themeSetting?: 'light' | 'dark' | 'system';
    }
  | undefined;

function applySystemBars() {
  const override = getOverride();
  const effective = override?.variant ?? appVariant;
  if (effective === 'light') {
    setLightContent(override?.color);
  } else if (effective === 'dark') {
    setDarkContent(override?.color);
  }
  // The window paint: the override pins it to its color, else its variant's
  // app ground; otherwise the app's own request is replayed verbatim (it
  // also carries the iOS user-interface-style side effect).
  if (override) {
    updateRootViewBackgroundColor(
      override.color ?? appGround(override.variant),
      override.variant,
      appRootViewBackground?.themeSetting,
    );
  } else if (appRootViewBackground) {
    updateRootViewBackgroundColor(
      appRootViewBackground.color,
      appRootViewBackground.themeVariant,
      appRootViewBackground.themeSetting,
    );
  }
}

export const getAppThemeVariant: IGetAppThemeVariant = () =>
  getOverride()?.variant ?? appVariant;

export const setSystemBarsOverride: ISetSystemBarsOverride = (
  ownerId,
  override,
) => {
  const current = overrides.get(ownerId);
  if (
    current?.variant === override?.variant &&
    current?.color === override?.color
  ) {
    return;
  }
  overrides.delete(ownerId);
  if (override) {
    overrides.set(ownerId, override);
  }
  applySystemBars();
};

/** The app-theme window paint, routed through the same single painter
 * so an active override is never clobbered by a theme change (the
 * NavigationContainer effect and the override writes race otherwise). */
export const updateAppRootViewBackground: IUpdateAppRootViewBackground = (
  color,
  themeVariant,
  themeSetting,
) => {
  appRootViewBackground = { color, themeVariant, themeSetting };
  if (overrides.size) {
    applySystemBars();
    return;
  }
  updateRootViewBackgroundColor(color, themeVariant, themeSetting);
};

export const useAppearanceTheme: IUseAppearanceTheme = (themeVariant) => {
  useLayoutEffect(() => {
    if (themeVariant === 'light' || themeVariant === 'dark') {
      appVariant = themeVariant;
      applySystemBars();
    }
  }, [themeVariant]);
};
