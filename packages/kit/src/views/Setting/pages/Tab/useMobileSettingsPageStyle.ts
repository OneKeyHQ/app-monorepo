import { useMemo } from 'react';

import { useTheme, useThemeName } from '@onekeyhq/components';

export function useMobileSettingsPageStyle(isMobileLayout: boolean) {
  const theme = useTheme();
  const themeName = useThemeName();
  const isDarkMode = themeName?.includes('dark');
  const themeBackgroundColor = isDarkMode
    ? ('$bgApp' as const)
    : ('$bgSubdued' as const);
  const pageBackgroundColor = isMobileLayout ? themeBackgroundColor : undefined;
  const headerStyle = useMemo(
    () =>
      isMobileLayout
        ? {
            backgroundColor: isDarkMode ? theme.bgApp.val : theme.bgSubdued.val,
          }
        : undefined,
    [isDarkMode, isMobileLayout, theme.bgApp.val, theme.bgSubdued.val],
  );

  return {
    headerStyle,
    pageBackgroundColor,
  };
}
