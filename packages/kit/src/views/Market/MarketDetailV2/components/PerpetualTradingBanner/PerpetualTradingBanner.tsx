import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, IconButton, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useTokenDetail } from '../../hooks/useTokenDetail';

export function PerpetualTradingBanner() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { tokenDetail } = useTokenDetail();
  const [dismissed, setDismissed] = useState(false);

  const hlTicker = tokenDetail?.perpsInfo?.hlTicker;

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handlePress = useCallback(() => {
    if (!hlTicker) return;
    defaultLogger.market.token.perpsBannerClick({
      tokenSymbol: tokenDetail?.symbol ?? '',
      hlTicker,
    });
    setTimeout(async () => {
      navigation.switchTab(ETabRoutes.Perp);
      try {
        await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
          coin: hlTicker,
        });
      } catch (error) {
        console.error('Failed to change active asset:', error);
      }
    }, 80);
  }, [hlTicker, navigation, tokenDetail?.symbol]);

  if (dismissed || !hlTicker) {
    return null;
  }

  const title = intl.formatMessage(
    { id: ETranslations.dexmarket_perpetual_trading_title },
    { tokenName: tokenDetail?.symbol },
  );

  return (
    <XStack
      py="$3"
      alignItems="center"
      justifyContent="space-between"
      onPress={handlePress}
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.6 }}
      userSelect="none"
      cursor="pointer"
    >
      <XStack alignItems="center" gap="$2" flex={1}>
        <Icon name="SpeakerPromoteOutline" size="$5" color="$iconSubdued" />
        <SizableText size="$bodyMd" flex={1} numberOfLines={1}>
          {title} →
        </SizableText>
      </XStack>
      <IconButton
        icon="CrossedSmallOutline"
        size="small"
        variant="tertiary"
        onPress={handleDismiss}
      />
    </XStack>
  );
}
