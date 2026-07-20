import { useCallback, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { setButtonStyleAsync } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getTokenValue } from '../shared/tamagui';

import {
  type ISystemUIAppearance,
  SystemUIAppearanceState,
} from './systemUIState';

const systemUIState = new SystemUIAppearanceState();
let navigationBarAppearanceUpdate = Promise.resolve();

const applyEffectiveAppearance = () => {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  const appearance = systemUIState.getEffectiveAppearance({
    themeVariant: 'dark',
    backgroundColor: getTokenValue('$bgAppDark', 'color'),
  });
  if (!appearance) {
    return;
  }

  const useLightContent = appearance.themeVariant === 'dark';
  StatusBar.setBarStyle(
    useLightContent ? 'light-content' : 'dark-content',
    true,
  );

  // In edge-to-edge mode the app draws the background below transparent
  // system bars. Only foreground icon appearance remains Window-owned.
  navigationBarAppearanceUpdate = navigationBarAppearanceUpdate
    .then(() => setButtonStyleAsync(useLightContent ? 'light' : 'dark'))
    .catch(() => undefined);

  updateRootViewBackgroundColor(
    appearance.backgroundColor,
    appearance.themeVariant,
    appearance.themeSetting,
  );
};

export const setSystemUIBaseAppearance: (
  appearance: ISystemUIAppearance,
) => void = (appearance) => {
  systemUIState.setBaseAppearance(appearance);
  applyEffectiveAppearance();
};

/**
 * Fixed-dark routes own the Activity/Window while focused. Navigation events
 * still fire when react-freeze suspends a blurred screen.
 */
export const useAndroidDarkSystemUIOverride = () => {
  const ownerRef = useRef(Symbol('system-ui-owner'));

  useFocusEffect(
    useCallback(() => {
      if (!platformEnv.isNativeMainThread) {
        return undefined;
      }
      const owner = ownerRef.current;
      systemUIState.addDarkOverride(owner);
      applyEffectiveAppearance();
      return () => {
        systemUIState.deleteDarkOverride(owner);
        systemUIState.scheduleBaseRestore(applyEffectiveAppearance);
      };
    }, []),
  );
};

export type {
  ISystemUIAppearance,
  ISystemUIThemeVariant,
} from './systemUIState';
