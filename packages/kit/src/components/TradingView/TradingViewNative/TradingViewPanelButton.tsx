import type { ComponentProps } from 'react';

import { Stack, useTheme } from '@onekeyhq/components';

import { TradingViewPanelIcon } from './TradingViewPanelIcon';

import type { TRADING_VIEW_PANEL_ICONS } from './multiChartIcons';

export function TradingViewPanelButton({
  icon,
  testID,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: keyof typeof TRADING_VIEW_PANEL_ICONS;
  testID: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress?: ComponentProps<typeof Stack>['onPress'];
}) {
  const theme = useTheme();
  return (
    <Stack
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      width={28}
      height={28}
      alignItems="center"
      justifyContent="center"
      borderRadius="$1"
      opacity={disabled ? 0.3 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { bg: '$bgHover' }}
      pressStyle={disabled ? undefined : { bg: '$bgActive' }}
      onPress={disabled ? undefined : onPress}
    >
      <TradingViewPanelIcon
        name={icon}
        size={icon === 'close' || icon === 'moveLeft' ? 12 : 20}
        color={theme.iconSubdued.val}
      />
    </Stack>
  );
}
