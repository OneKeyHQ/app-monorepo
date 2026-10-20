import { useMemo } from 'react';

import { useTheme } from '@onekeyhq/components';

import type { NativeListTheme } from '@onekeyfe/react-native-native-list';

export function useHomeNativeListTheme(): NativeListTheme {
  const theme = useTheme();
  return useMemo(
    () => ({
      background: theme.bgApp.val,
      rowBackground: theme.bgApp.val,
      rowSelectedBackground: theme.bgActive.val,
      rowPressedBackground: theme.bgActive.val,
      subduedBackground: theme.bgSubdued.val,
      strongBackground: theme.bgStrong.val,
      primaryText: theme.text.val,
      secondaryText: theme.textSubdued.val,
      disabledText: theme.textDisabled.val,
      icon: theme.icon.val,
      iconSubdued: theme.iconSubdued.val,
      separator: theme.borderSubdued.val,
      accent: theme.iconActive.val,
      positive: theme.textSuccess.val,
      negative: theme.textCritical.val,
      criticalBackground: theme.bgCritical.val,
      inverseBackground: theme.bgInverse.val,
      inverseText: theme.textInverse.val,
      info: theme.textInfo.val,
      caution: theme.textCaution.val,
    }),
    [theme],
  );
}
