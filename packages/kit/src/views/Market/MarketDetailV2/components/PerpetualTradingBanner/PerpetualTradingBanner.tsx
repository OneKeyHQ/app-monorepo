import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBannerClosePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useTokenDetail } from '../../hooks/useTokenDetail';

const PERPS_BANNER_ID = 'perps-trading-banner';

export function PerpetualTradingBanner({
  pl,
  pr,
  px,
}: {
  pl?: string;
  pr?: string;
  px?: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { tokenDetail, perpsInfo } = useTokenDetail();
  const [bannerClose, setBannerClose] = useBannerClosePersistAtom();

  const hlTicker = perpsInfo?.hlTicker;

  const dismissed = useMemo(
    () => bannerClose.ids.includes(PERPS_BANNER_ID),
    [bannerClose.ids],
  );

  const handleDismiss = useCallback(() => {
    setBannerClose({
      ids: [...new Set([...bannerClose.ids, PERPS_BANNER_ID])],
    });
  }, [bannerClose.ids, setBannerClose]);

  const handlePress = useCallback(() => {
    if (!hlTicker) return;
    defaultLogger.market.token.perpsBannerClick({
      tokenSymbol: tokenDetail?.symbol ?? '',
      hlTicker,
    });
    setTimeout(async () => {
      setPerpPageEnterSource(EPerpPageEnterSource.MarketBanner);
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
    <YStack
      $gtMd={{ borderBottomWidth: '$px', borderBottomColor: '$borderSubdued' }}
    >
      <XStack
        py="$3"
        pl={pl ?? px}
        pr={pr ?? px}
        alignItems="center"
        justifyContent="space-between"
        onPress={handlePress}
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.6 }}
        userSelect="none"
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
    </YStack>
  );
}
