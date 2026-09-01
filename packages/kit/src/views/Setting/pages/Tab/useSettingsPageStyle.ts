import { useMemo } from 'react';

import { useTheme, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  resolveSettingsHeaderBackgroundTokenKey,
  resolveSettingsPageBackgroundTokenKey,
} from './settingsSurface';

export function useSettingsPageStyle(enabled: boolean) {
  const theme = useTheme();
  const themeName = useThemeName();
  // Light grouped lists use a subdued canvas with bright cards. Dark themes
  // need the deeper app canvas so the regular background token stays visible.
  const tokenKey = resolveSettingsPageBackgroundTokenKey({
    enabled,
    themeName,
  });
  const pageBackgroundColor = tokenKey
    ? (`$${tokenKey}` as '$bgApp' | '$bgSubdued')
    : undefined;
  const headerTokenKey = resolveSettingsHeaderBackgroundTokenKey({
    isNativeIOS: Boolean(platformEnv.isNativeIOS),
    pageBackgroundTokenKey: tokenKey,
  });
  const headerBackgroundValue = headerTokenKey
    ? theme[headerTokenKey].val
    : undefined;
  const headerStyle = useMemo(
    () =>
      headerTokenKey ? { backgroundColor: headerBackgroundValue } : undefined,
    [headerBackgroundValue, headerTokenKey],
  );

  return {
    headerBackgroundColor: headerBackgroundValue,
    headerStyle,
    pageBackgroundColor,
  };
}
