import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getPrimeGiftDurationText } from '../hooks/primeGiftDuration';
import { useOpenPrimeGiftClaim } from '../hooks/useOpenPrimeGiftClaim';
import { usePrimeGiftOfferImpression } from '../hooks/usePrimeGiftOfferImpression';

import type { IPrimeGiftClaimableDevice } from '../hooks/primeGiftClaimableDevices';
import type { IntlShape } from 'react-intl';

const NO_CLAIMABLE_DEVICES: IPrimeGiftClaimableDevice[] = [];

// One dashboard card per visit. Eligibility responses arrive one device at a
// time, and this key must stay put so those arrivals are not new impressions.
const DASHBOARD_IMPRESSION_KEY = 'primeDashboard';

function dashboardEntryDescription(
  devices: IPrimeGiftClaimableDevice[],
  intl: IntlShape,
) {
  const durations = devices.map((item) =>
    getPrimeGiftDurationText(item.eligibility, intl),
  );
  const duration = durations[0];
  const sameDuration =
    Boolean(duration) && durations.every((value) => value === duration);
  if (!sameDuration || !duration) {
    return intl.formatMessage({
      id: ETranslations.prime_gift_dashboard__desc,
    });
  }
  return intl.formatMessage(
    { id: ETranslations.prime_gift_dashboard_claim_duration__desc },
    { duration },
  );
}

export function PrimeGiftDashboardEntry({
  devices,
  isPrimeActive = false,
}: {
  devices: IPrimeGiftClaimableDevice[] | undefined;
  isPrimeActive?: boolean;
}) {
  const intl = useIntl();
  const openClaim = useOpenPrimeGiftClaim();
  const claimable = devices ?? NO_CLAIMABLE_DEVICES;
  const deviceCount = claimable.length;
  const impressionRef = usePrimeGiftOfferImpression({
    enabled: deviceCount > 0,
    serialNo: DASHBOARD_IMPRESSION_KEY,
    source: 'primeDashboard',
    deviceCount: deviceCount > 0 ? deviceCount : undefined,
  });
  const handlePress = useCallback(() => {
    openClaim(claimable);
  }, [claimable, openClaim]);
  if (!deviceCount) return null;
  return (
    <XStack px="$5" pt="$5">
      <XStack
        ref={impressionRef}
        testID="prime-gift-dashboard-entry"
        accessibilityRole="button"
        focusable
        cursor="default"
        userSelect="none"
        width="100%"
        minHeight={44}
        bg="$bgSubdued"
        borderWidth={1}
        borderColor="$neutral3"
        borderRadius="$4"
        borderCurve="continuous"
        pl="$2"
        pr="$3"
        py="$3"
        alignItems="center"
        gap="$2"
        onPress={handlePress}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      >
        {/* Match a real claimable device's wallpaper; the first stands in for several. */}
        <WalletAvatar wallet={claimable[0].wallet} size={48} />
        <YStack flex={1} minWidth={0} gap="$1">
          <SizableText size="$bodyLgMedium" cursor="default" userSelect="none">
            {intl.formatMessage({
              id: ETranslations.prime_gift_dashboard__title,
            })}
          </SizableText>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            cursor="default"
            userSelect="none"
          >
            {isPrimeActive
              ? intl.formatMessage({
                  id: ETranslations.prime_gift_existing_member__desc,
                })
              : dashboardEntryDescription(claimable, intl)}
          </SizableText>
        </YStack>
        <Icon
          name="ChevronRightSmallOutline"
          color="$iconSubdued"
          size="$5"
          flexShrink={0}
        />
      </XStack>
    </XStack>
  );
}
