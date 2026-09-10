import { useCallback, useEffect, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { usePrimeGiftEligibilityPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { getPrimeGiftDurationText } from '../hooks/primeGiftDuration';

export function PrimeGiftOffer({
  device,
  source,
  onboardingRouteKey,
  skipInitialRefresh = false,
}: {
  device: IDBDevice;
  source: 'onboarding' | 'deviceDetails';
  onboardingRouteKey?: string;
  skipInitialRefresh?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const theme = useThemeName();
  const serialNo = deviceUtils.getDeviceSerialNoFromDbDevice(device);
  const [eligibilityBySerialNo] = usePrimeGiftEligibilityPersistAtom();
  const eligibility = serialNo ? eligibilityBySerialNo[serialNo] : undefined;
  const skipInitialRefreshRef = useRef(skipInitialRefresh);
  const refresh = useCallback(() => {
    if (!serialNo) {
      return;
    }
    void backgroundApiProxy.servicePrime
      .apiGetPrimeGiftEligibility({ serialNo })
      .catch(() => undefined);
  }, [serialNo]);
  useFocusEffect(
    useCallback(() => {
      if (skipInitialRefreshRef.current) {
        skipInitialRefreshRef.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const onRedeemed = (event: { serialNo: string }) => {
      if (event.serialNo === serialNo) {
        refresh();
      }
    };
    appEventBus.on(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    };
  }, [serialNo, refresh]);
  if (!serialNo || !eligibility?.eligible || !eligibility.hasUnclaimedGift)
    return null;
  return (
    <XStack
      testID={`prime-gift-offer-${source}`}
      accessibilityRole="button"
      focusable
      alignItems="center"
      gap="$3"
      minHeight={88}
      px="$4"
      py="$4"
      bg="$bgSubdued"
      borderRadius="$4"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() =>
        navigation.pushModal(EModalRoutes.PrimeModal, {
          screen: EPrimePages.PrimeGift,
          params: {
            device: deviceUtils.dbDeviceToSearchDevice(device),
            serialNo,
            source,
            onboardingRouteKey,
          },
        })
      }
    >
      <Icon
        name={
          theme === 'light'
            ? 'OnekeyPrimeLightColored'
            : 'OnekeyPrimeDarkColored'
        }
        size="$6"
      />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage(
            { id: ETranslations.prime_gift_offer__title },
            { duration: getPrimeGiftDurationText(eligibility, intl) },
          )}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id:
              source === 'onboarding'
                ? ETranslations.prime_gift_later__desc
                : ETranslations.prime_gift_device_once__desc,
          })}
        </SizableText>
      </YStack>
      <XStack alignItems="center" gap="$0.5" flexShrink={0}>
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.earn_claim })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
