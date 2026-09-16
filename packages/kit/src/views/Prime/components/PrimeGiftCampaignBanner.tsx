import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

import { usePrimeGiftCampaignBannerImpression } from '../hooks/usePrimeGiftCampaignBannerImpression';
import { usePrimeGiftClaimSuccessLink } from '../hooks/usePrimeGiftClaimSuccessLink';

import type { LayoutChangeEvent } from 'react-native';

export function PrimeGiftCampaignBanner() {
  const intl = useIntl();
  const [isWide, setIsWide] = useState(false);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setIsWide(event.nativeEvent.layout.width >= 480);
  }, []);
  const item = usePrimeGiftClaimSuccessLink();
  const impressionRef = usePrimeGiftCampaignBannerImpression({
    enabled: Boolean(item),
    linkId: item?.linkId,
  });
  const handlePress = useCallback(() => {
    if (!item) {
      return;
    }
    const handled = parseNotificationPayload(item.mode, item.payload, () => {});
    if (!handled) {
      return;
    }
    defaultLogger.prime.subscription.primeGiftClaimSuccessBannerClick({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: item.linkId,
    });
  }, [item]);
  if (!item) {
    return null;
  }
  return (
    <XStack
      ref={impressionRef}
      onLayout={handleLayout}
      mt="$4"
      width="100%"
      minHeight={44}
      bg="$bgSubdued"
      borderWidth={1}
      borderColor="$neutral3"
      borderRadius="$4"
      borderCurve="continuous"
      p="$4"
      alignItems="center"
      gap="$3"
      accessibilityRole="button"
      focusable
      onPress={handlePress}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <YStack flex={1} minWidth={0} gap="$1">
        {item.description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {item.description}
          </SizableText>
        ) : null}
        {item.title ? (
          <SizableText size="$headingSm">{item.title}</SizableText>
        ) : null}
        <XStack mt="$3" alignItems="center" gap="$1" flexShrink={0}>
          <SizableText size="$bodySmMedium" color="$textInteractive">
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$textInteractive" />
        </XStack>
      </YStack>
      {item.image ? (
        <Image
          width={isWide ? 128 : 96}
          height={isWide ? 96 : 72}
          flexShrink={0}
          contentFit="contain"
          source={{ uri: item.image }}
        />
      ) : null}
    </XStack>
  );
}
