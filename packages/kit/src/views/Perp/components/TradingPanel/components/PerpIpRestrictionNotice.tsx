import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PERPS_IP_RESTRICTION_HELP_URL } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { openGuideUrl } from '../../Guide/perpGuideData';

export function PerpIpRestrictionNotice({
  isMobile = false,
  isSpot = false,
}: {
  isMobile?: boolean;
  isSpot?: boolean;
}) {
  const intl = useIntl();
  const handleLearnMore = useCallback(() => {
    openGuideUrl(PERPS_IP_RESTRICTION_HELP_URL);
  }, []);

  return (
    <YStack
      gap="$2"
      p={isMobile ? '$3.5' : '$3'}
      borderRadius="$4"
      bg="$bgSubdued"
    >
      <XStack gap="$2" alignItems="center">
        <YStack>
          <Icon name="InfoCircleSolid" size="$3.5" color="$iconSubdued" />
        </YStack>
        <SizableText size="$bodySm" fontWeight="600" flex={1}>
          {intl.formatMessage({
            id: ETranslations.perp_ip_restriction__title,
          })}
        </SizableText>
      </XStack>

      <YStack gap="$1.5">
        <SizableText size="$bodyXs" color="$textSubdued">
          {intl.formatMessage({
            id: isSpot
              ? ETranslations.perp_ip_restriction_spot__desc
              : ETranslations.perp_ip_restriction_perp__desc,
          })}
        </SizableText>

        <XStack
          gap="$1"
          alignItems="center"
          cursor="pointer"
          onPress={handleLearnMore}
        >
          <SizableText size="$bodyXs" color="$textInteractive">
            {intl.formatMessage({
              id: ETranslations.global_learn_more,
            })}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$textInteractive"
          />
        </XStack>
      </YStack>
    </YStack>
  );
}
