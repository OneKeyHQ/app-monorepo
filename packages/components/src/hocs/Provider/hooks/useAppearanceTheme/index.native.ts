import { useLayoutEffect } from 'react';

import { setStyle } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  DEFAULT_SYSTEM_BARS_OVERRIDE_OWNER,
  type ISystemBarsVariant,
  resolveSystemBarsOverride,
  upsertSystemBarsOverridePin,
} from './resolveSystemBarsOverride';

import type {
  IGetAppThemeVariant,
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
// underneath, and named foreground pins on top (onboarding and
// theme-locked modals keep content dark while the app theme usually
// is not). Dark pins win so stacked dark surfaces never flash light
// when one of them blurs. Every writer repaints through
// applySystemBars, so ordering can never leave a stale coat.
//
// Two mechanisms per repaint, because Android changed the rules: the
// bar-color calls above paint real bar surfaces up to Android 14, and
// under enforced edge-to-edge (targetSdk 35+, Android 15+) become
// no-ops — there the "bars" are transparent over the WINDOW background
// (the app content sits inset by fitsSystemWindows), so the window
// paint below is what actually colors the bands. The icon styles work
// on both eras.
let appVariant: ISystemBarsVariant | undefined;
const overridePins = new Map<string, ISystemBarsVariant>();
// The app's own window-background request (NavigationContainer keeps it
// on the app theme), replayed on override release.
let appRootViewBackground:
  | {
      color: string;
      themeVariant: ISystemBarsVariant;
      themeSetting?: 'light' | 'dark' | 'system';
    }
  | undefined;

function getOverrideVariant(): ISystemBarsVariant | null {
  return resolveSystemBarsOverride(overridePins.values());
}

function applySystemBars() {
  const overrideVariant = getOverrideVariant();
  const effective = overrideVariant ?? appVariant;
  if (effective === 'light') {
    setLightContent();
  } else if (effective === 'dark') {
    setDarkContent();
  }
  // The window paint: an active pin uses its variant's app ground;
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

export const getAppThemeVariant: IGetAppThemeVariant = () =>
  getOverrideVariant() ?? appVariant;

export const setSystemBarsOverride: ISetSystemBarsOverride = (
  variant,
  owner = DEFAULT_SYSTEM_BARS_OVERRIDE_OWNER,
) => {
  if (!upsertSystemBarsOverridePin(overridePins, owner, variant)) {
    return;
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
  if (getOverrideVariant()) {
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
