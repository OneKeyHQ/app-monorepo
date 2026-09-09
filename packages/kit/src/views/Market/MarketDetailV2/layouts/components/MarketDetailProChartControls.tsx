import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Stack, XStack } from '@onekeyhq/components';
import {
  type ITradingViewChartMode,
  TradingViewChartModeSelect,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/utils/NativeChartControlsShared';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function MarketDetailProChartControls({
  testID,
  fullscreenTestID,
  top,
  inline = false,
  chartMode,
  isChartSwitchDisabled,
  onChartSwitch,
  onEnterChartFullscreen,
  children,
}: PropsWithChildren<{
  testID: string;
  fullscreenTestID: string;
  top: number;
  inline?: boolean;
  chartMode: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch: () => void;
  onEnterChartFullscreen: () => void;
}>) {
  const intl = useIntl();

  return (
    <XStack
      testID={testID}
      position={inline ? 'relative' : 'absolute'}
      top={inline ? undefined : top}
      right={inline ? undefined : 0}
      flexShrink={0}
      alignItems="center"
      gap="$2"
      bg="$bgApp"
      pl="$2"
      zIndex={4}
    >
      <TradingViewChartModeSelect
        chartMode={chartMode}
        isDisabled={isChartSwitchDisabled}
        onChartSwitch={onChartSwitch}
      />
      <Stack width="$px" height="$5" bg="$borderSubdued" flexShrink={0} />
      <IconButton
        testID={fullscreenTestID}
        size="small"
        variant="tertiary"
        icon="TradingViewFullscreenCustom"
        iconSize="$5"
        title={intl.formatMessage({ id: ETranslations.global_expand })}
        onPress={onEnterChartFullscreen}
        {...HEADER_ICON_BUTTON_STYLE_PROPS}
      />
      <Stack width="$px" height="$5" bg="$borderSubdued" flexShrink={0} />
      {children}
    </XStack>
  );
}
