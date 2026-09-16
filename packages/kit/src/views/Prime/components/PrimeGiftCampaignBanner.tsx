import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  type ILinkConfigItem,
  PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
} from '@onekeyhq/shared/types/linkConfig';

import { usePrimeGiftCampaignBannerImpression } from '../hooks/usePrimeGiftCampaignBannerImpression';
import { usePrimeGiftClaimSuccessLink } from '../hooks/usePrimeGiftClaimSuccessLink';

export function PrimeGiftCampaignBanner({
  itemsOverride,
}: {
  itemsOverride?: ILinkConfigItem[];
}) {
  const intl = useIntl();
  const item = usePrimeGiftClaimSuccessLink(itemsOverride);
  const impressionRef = usePrimeGiftCampaignBannerImpression({
    enabled: Boolean(item),
    slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
    linkId: item?.linkId,
  });
  const handlePress = useCallback(() => {
    if (!item) {
      return;
    }
    defaultLogger.prime.subscription.primeGiftClaimSuccessBannerClick({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: item.linkId,
    });
    parseNotificationPayload(item.mode, item.payload, () => {});
  }, [item]);
  if (!item) {
    return null;
  }
  return (
    <XStack
      ref={impressionRef}
      mt="$4"
      width="100%"
      minHeight={44}
      bg="$bgSubdued"
      borderRadius="$4"
      p="$4"
      alignItems="center"
      gap="$3"
      accessibilityRole="button"
      focusable
      testID="prime-gift-campaign-banner"
      onPress={handlePress}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <YStack flex={1} minWidth={0} gap="$0.5">
        {item.title ? (
          <SizableText size="$bodyLgMedium">{item.title}</SizableText>
        ) : null}
        {item.description ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {item.description}
          </SizableText>
        ) : null}
        <XStack alignItems="center" gap="$0.5" flexShrink={0}>
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      </YStack>
      {item.image ? (
        <Image
          width={48}
          height={48}
          borderRadius="$2"
          flexShrink={0}
          source={{ uri: item.image }}
        />
      ) : null}
    </XStack>
  );
}
