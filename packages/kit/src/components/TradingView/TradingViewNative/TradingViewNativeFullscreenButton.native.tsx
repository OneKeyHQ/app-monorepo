import { useIntl } from 'react-intl';

import {
  IconButton,
  isNativeTablet,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TRADING_VIEW_CHART_CONTROLS_HEIGHT } from '../TradingViewChartControls';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from '../TradingViewChartControls/utils/NativeChartControlsShared';

import { getTradingViewNativeFullscreenButtonBottom } from './utils/fullscreenLayout';

import type { ITradingViewNativeFullscreenButtonProps } from './TradingViewNativeFullscreenButton.types';

// Expanded Android tablets can clip one controls row from the chart's logical bottom.
const ANDROID_TABLET_FULLSCREEN_BOTTOM_OFFSET =
  TRADING_VIEW_CHART_CONTROLS_HEIGHT + 8;

export function TradingViewNativeFullscreenButton({
  chartHeight,
  isFullscreen,
  onPress,
  visibleSubIndicatorCount,
}: ITradingViewNativeFullscreenButtonProps) {
  const intl = useIntl();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const tabletFullscreenBottomOffset =
    isFullscreen && platformEnv.isNativeAndroid && isNativeTablet()
      ? ANDROID_TABLET_FULLSCREEN_BOTTOM_OFFSET
      : 0;

  return (
    <IconButton
      testID="trading-view-native-fullscreen-toggle"
      position="absolute"
      left="$8"
      bottom={
        getTradingViewNativeFullscreenButtonBottom({
          chartHeight,
          paneCount: visibleSubIndicatorCount,
        }) +
        (isFullscreen ? safeAreaBottom : 0) +
        tabletFullscreenBottomOffset
      }
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
