import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../TradingViewChartControls/utils/NativeChartControlsShared';

import { getTradingViewNativeFullscreenButtonBottom } from './utils/fullscreenLayout';

import type { ITradingViewNativeFullscreenButtonProps } from './TradingViewNativeFullscreenButton.types';

export function TradingViewNativeFullscreenButton({
  chartHeight,
  isFullscreen,
  onPress,
  timeAxisHeight,
  visibleSubIndicatorCount,
}: ITradingViewNativeFullscreenButtonProps) {
  const intl = useIntl();

  return (
    <IconButton
      testID="trading-view-native-fullscreen-toggle"
      position="absolute"
      left="$5"
      bottom={getTradingViewNativeFullscreenButtonBottom({
        chartHeight,
        paneCount: visibleSubIndicatorCount,
        timeAxisHeight,
      })}
      zIndex={2}
      size="small"
      variant="tertiary"
      icon={
        isFullscreen
          ? 'TradingViewExitFullscreenCustom'
          : 'TradingViewFullscreenCustom'
      }
      iconSize="$5"
      title={intl.formatMessage({
        id: isFullscreen
          ? ETranslations.global_collapse
          : ETranslations.global_expand,
      })}
      onPress={onPress}
      borderWidth="$px"
      borderColor="$borderSubdued"
      {...HEADER_ICON_BUTTON_STYLE_PROPS}
      bg="$bgApp"
    />
  );
}
