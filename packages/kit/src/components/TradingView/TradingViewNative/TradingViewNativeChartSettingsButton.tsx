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
  panelId,
  priceAxisWidth,
  enablePreviousClose = false,
  isChartSwitchDisabled = false,
  onChartSwitch,
  onBeforeOpenSettings,
  placement = 'chart',
}: {
  panelId?: string;
  priceAxisWidth: number;
  enablePreviousClose?: boolean;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
  onBeforeOpenSettings?: () => void;
  placement?: 'chart' | 'toolbar';
}) {
  const isToolbar = placement === 'toolbar';
  const intl = useIntl();
  const navigation = useAppNavigation();
  const openChartSettingsModal = useCallback(() => {
    onBeforeOpenSettings?.();
    navigation.pushModal(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MarketChartSettings,
      params: {
        showPreviousClose: enablePreviousClose,
        ...(panelId ? { panelId } : {}),
      },
    });
  }, [enablePreviousClose, navigation, onBeforeOpenSettings, panelId]);
  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_settings }),
      showFooter: false,
      testID: 'trading-view-native-chart-settings-quick-dialog',
      renderContent: (
        <TradingViewMobileChartSettingsDialogContent
          panelId={panelId}
          chartMode="native"
          isChartSwitchDisabled={isChartSwitchDisabled}
          showPreviousClose={enablePreviousClose}
          onChartSwitch={onChartSwitch}
          onOpenSettings={openChartSettingsModal}
        />
      ),
    });
  }, [
    enablePreviousClose,
    intl,
    isChartSwitchDisabled,
    onChartSwitch,
    panelId,
    openChartSettingsModal,
  ]);

  return (
    <IconButton
      testID="trading-view-native-chart-settings-trigger"
      position={isToolbar ? undefined : 'absolute'}
      right={
        isToolbar
          ? undefined
          : getTradingViewNativeChartSettingsButtonRight(priceAxisWidth)
      }
      bottom={isToolbar ? undefined : 0}
      zIndex={3}
      width={isToolbar ? 32 : SETTINGS_BUTTON_SIZE}
      height={isToolbar ? 32 : SETTINGS_BUTTON_SIZE}
      p="$1"
      size="small"
      variant="tertiary"
      icon={isToolbar ? 'SliderHorOutline' : 'SettingsOutline'}
      iconSize={isToolbar ? '$5' : '$4'}
      accessibilityLabel={intl.formatMessage({
        id: ETranslations.market_chart_settings,
      })}
      onPress={handlePress}
      {...HEADER_ICON_BUTTON_STYLE_PROPS}
      bg={isToolbar ? '$transparent' : '$bgApp'}
      borderWidth={0}
    />
  );
}
