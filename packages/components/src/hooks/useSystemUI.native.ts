import { useLayoutEffect, useRef } from 'react';

import { setButtonStyleAsync } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  type ISystemUIAppearance,
  SystemUIAppearanceRegistry,
} from './systemUIState';

export type ISystemUIAppearanceOverride = ISystemUIAppearance & {
  enabled?: boolean;
};

const registry = new SystemUIAppearanceRegistry();

let appliedAppearance: ISystemUIAppearance | undefined;

const isSameAppearance = (
  first: ISystemUIAppearance | undefined,
  second: ISystemUIAppearance,
) =>
  first?.themeVariant === second.themeVariant &&
  first?.backgroundColor === second.backgroundColor &&
  first?.themeSetting === second.themeSetting;

const applyEffectiveAppearance = () => {
  if (!platformEnv.isNativeMainThread) {
    return;
  }
  const appearance = registry.getEffectiveAppearance();
  if (!appearance || isSameAppearance(appliedAppearance, appearance)) {
    return;
  }
  appliedAppearance = appearance;

  const useLightContent = appearance.themeVariant === 'dark';
  StatusBar.setBarStyle(
    useLightContent ? 'light-content' : 'dark-content',
    true,
  );

  if (platformEnv.isNativeAndroid) {
    // In edge-to-edge mode the app draws the background below transparent
    // system bars. Only foreground icon appearance remains Window-owned.
    void setButtonStyleAsync(useLightContent ? 'light' : 'dark').catch(
      () => undefined,
    );
  }

  updateRootViewBackgroundColor(
    appearance.backgroundColor,
    appearance.themeVariant,
    appearance.themeSetting,
  );
};

export const setSystemUIBaseAppearance: (
  appearance: ISystemUIAppearance,
) => void = (appearance) => {
  registry.setBaseAppearance(appearance);
  applyEffectiveAppearance();
};

/**
 * Temporarily owns the native Activity/Window appearance while a route is in
 * the foreground. Removing the owner restores the next visible route, or the
 * resolved app theme when no override remains.
 */
export const useSystemUIAppearanceOverride: (
  override: ISystemUIAppearanceOverride,
) => void = ({
  enabled = true,
  themeVariant,
  backgroundColor,
  themeSetting,
}) => {
  const ownerRef = useRef(Symbol('system-ui-owner'));

  useLayoutEffect(() => {
    if (!enabled || !platformEnv.isNativeMainThread) {
      return undefined;
    }
    const owner = ownerRef.current;
    registry.setOverride(owner, {
      themeVariant,
      backgroundColor,
      themeSetting,
    });
    applyEffectiveAppearance();

    return () => {
      registry.deleteOverride(owner);
      applyEffectiveAppearance();
    };
  }, [backgroundColor, enabled, themeSetting, themeVariant]);
};

export type {
  ISystemUIAppearance,
  ISystemUIThemeVariant,
} from './systemUIState';
