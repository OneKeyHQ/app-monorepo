import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, IconButton } from '@onekeyhq/components';
import { HEADER_ICON_BUTTON_STYLE_PROPS } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/utils/NativeChartControlsShared';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewMobileChartSettingsDialogContent } from './TradingViewMobileChartSettingsDialogContent';

const SETTINGS_BUTTON_SIZE = 24;
const PRICE_AXIS_FALLBACK_WIDTH = 52;

export function getTradingViewNativeChartSettingsButtonRight(
  priceAxisWidth: number,
) {
  const normalizedPriceAxisWidth =
    Number.isFinite(priceAxisWidth) && priceAxisWidth > 0
      ? priceAxisWidth
      : PRICE_AXIS_FALLBACK_WIDTH;
  return Math.max((normalizedPriceAxisWidth - SETTINGS_BUTTON_SIZE) / 2, 0);
}

export function TradingViewNativeChartSettingsButton({
  priceAxisWidth,
}: {
  priceAxisWidth: number;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const openChartSettingsModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MarketChartSettings,
    });
  }, [navigation]);
  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_settings }),
      showFooter: false,
      testID: 'trading-view-native-chart-settings-quick-dialog',
      renderContent: (
        <TradingViewMobileChartSettingsDialogContent
          onOpenSettings={openChartSettingsModal}
        />
      ),
    });
  }, [intl, openChartSettingsModal]);

  return (
    <IconButton
      testID="trading-view-native-chart-settings-trigger"
      position="absolute"
      right={getTradingViewNativeChartSettingsButtonRight(priceAxisWidth)}
      bottom={0}
      zIndex={3}
      width={SETTINGS_BUTTON_SIZE}
      height={SETTINGS_BUTTON_SIZE}
      p="$1"
      size="small"
      variant="tertiary"
      icon="SettingsOutline"
      iconSize="$4"
      accessibilityLabel={intl.formatMessage({
        id: ETranslations.market_chart_settings,
      })}
      onPress={handlePress}
      {...HEADER_ICON_BUTTON_STYLE_PROPS}
      bg="$bgApp"
      borderWidth={0}
    />
  );
}
