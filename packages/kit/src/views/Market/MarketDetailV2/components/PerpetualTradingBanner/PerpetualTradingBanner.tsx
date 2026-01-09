import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../hooks/useTokenDetail';

type IPerpetualTradingBannerProps = {
  onPress?: () => void;
};

export function PerpetualTradingBanner({
  onPress,
}: IPerpetualTradingBannerProps) {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (dismissed || !tokenDetail?.symbol) {
    return null;
  }

  const title = intl.formatMessage(
    { id: ETranslations.dexmarket_perpetual_trading_title },
    { tokenName: tokenDetail.symbol },
  );

  return (
    <XStack
      py="$3"
      alignItems="center"
      justifyContent="space-between"
      onPress={onPress}
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
