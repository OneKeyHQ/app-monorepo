import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useBannerClosePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTokenDetail } from '../../hooks/useTokenDetail';

const PERPS_BANNER_ID = 'perps-trading-banner';

export function PerpetualTradingBanner({
  pl,
  pr,
  px,
  py = '$3',
  stableLayout = false,
  reserveSpace = false,
  disabled = false,
}: {
  pl?: string;
  pr?: string;
  px?: string;
  py?: string;
  stableLayout?: boolean;
  reserveSpace?: boolean;
  disabled?: boolean;
}) {
  const intl = useIntl();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketBanner,
  );
  const { perpDisabled } = usePerpTabConfig();
  const { tokenDetail, perpsInfo } = useTokenDetail();
  const [bannerClose, setBannerClose] = useBannerClosePersistAtom();

  const hlTicker = perpsInfo?.hlTicker;
  // Native detail mounts this only after the first request has settled.
  // A later retry must not insert a banner above an already visible chart.
  const [initiallyVisible] = useState(Boolean(hlTicker));

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
    if (!hlTicker || perpDisabled) return;
    defaultLogger.market.token.perpsBannerClick({
      tokenSymbol: tokenDetail?.symbol ?? '',
      hlTicker,
    });
    navigateToPerps(hlTicker);
  }, [hlTicker, navigateToPerps, perpDisabled, tokenDetail?.symbol]);

  const isVisible = Boolean(hlTicker) && (!stableLayout || initiallyVisible);
  const shouldReserveSpace = reserveSpace || (stableLayout && initiallyVisible);

  if (
    disabled ||
    perpDisabled ||
    dismissed ||
    (!shouldReserveSpace && !isVisible)
  )
    return null;

  const title = intl.formatMessage(
    { id: ETranslations.dexmarket_perpetual_trading_title },
    { tokenName: tokenDetail?.symbol },
  );

  return (
    <XStack
      opacity={isVisible ? 1 : 0}
      pointerEvents={isVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      {...(platformEnv.isNative
        ? {}
        : { 'aria-hidden': !isVisible, inert: !isVisible })}
      py={py}
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
        testID="market-title-icon-btn"
        icon="CrossedSmallOutline"
        size="small"
        variant="tertiary"
        onPress={handleDismiss}
      />
    </XStack>
  );
}
