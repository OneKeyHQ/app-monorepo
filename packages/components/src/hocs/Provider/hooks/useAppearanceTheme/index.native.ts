import { useLayoutEffect } from 'react';

import { setStyle } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  ISetSystemBarsOverride,
  IUpdateAppRootViewBackground,
  IUseAppearanceTheme,
} from './type';

const setDarkContent = (isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppDark', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    setStyle('light');
  }
};

const setLightContent = (isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppLight', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
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
// Two mechanisms per repaint, because Android changed the rules: the
// bar-color calls above paint real bar surfaces up to Android 14, and
// under enforced edge-to-edge (targetSdk 35+, Android 15+) become
// no-ops — there the "bars" are transparent over the WINDOW background
// (the app content sits inset by fitsSystemWindows), so the window
// paint below is what actually colors the bands. The icon styles work
// on both eras.
let appVariant: 'light' | 'dark' | undefined;
let overrideVariant: 'light' | 'dark' | null = null;
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
  const effective = overrideVariant ?? appVariant;
  if (effective === 'light') {
    setLightContent();
  } else if (effective === 'dark') {
    setDarkContent();
  }
  // The window paint: the override pins it to its variant's app ground;
  // otherwise the app's own request is replayed verbatim (it also
  // carries the iOS user-interface-style side effect).
  if (overrideVariant) {
    updateRootViewBackgroundColor(
      getTokenValue(
        overrideVariant === 'dark' ? '$bgAppDark' : '$bgAppLight',
        'color',
      ) as string,
      overrideVariant,
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

export const setSystemBarsOverride: ISetSystemBarsOverride = (variant) => {
  if (overrideVariant === variant) {
    return;
  }
  overrideVariant = variant;
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
  if (overrideVariant) {
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
