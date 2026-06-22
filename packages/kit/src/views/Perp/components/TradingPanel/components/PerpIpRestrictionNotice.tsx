import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const handleRecheck = useCallback(() => {
    if (isCheckingRef.current) {
      return;
    }
    isCheckingRef.current = true;
    setIsChecking(true);
    void backgroundApiProxy.serviceHyperliquid
      .updatePerpsConfigByServerSilently({ ignoreCache: true })
      .finally(() => {
        isCheckingRef.current = false;
        if (isMountedRef.current) {
          setIsChecking(false);
        }
      });
  }, []);

  const handleLearnMore = useCallback(() => {
    openGuideUrl(PERPS_IP_RESTRICTION_HELP_URL);
  }, []);

  const recheckText = intl.formatMessage({
    id: ETranslations.redetect__action,
  });

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

        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <XStack
            gap="$1"
            alignItems="center"
            cursor={isChecking ? 'default' : 'pointer'}
            onPress={handleRecheck}
          >
            {isChecking ? (
              <Spinner size="small" color="$textInteractive" scale={0.65} />
            ) : null}
            <SizableText size="$bodyXs" color="$textInteractive">
              {recheckText}
            </SizableText>
          </XStack>
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
        </XStack>
      </YStack>
    </YStack>
  );
}
