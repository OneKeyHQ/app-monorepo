import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { usePrimeGiftMessages } from '../hooks/usePrimeGiftMessages';

import type { SearchDevice } from '@onekeyfe/hd-core';

export function PrimeGiftOffer({
  device,
  serialNo,
  source,
}: {
  device: Omit<SearchDevice, 'commType'>;
  serialNo?: string;
  source: 'onboarding' | 'deviceDetails';
}) {
  const navigation = useAppNavigation();
  const theme = useThemeName();
  const message = usePrimeGiftMessages();
  const requestRef = useRef(0);
  const [offer, setOffer] = useState<{
    serialNo: string;
    eligibility: IPrimeGiftEligibility;
  }>();
  const refresh = useCallback(() => {
    requestRef.current += 1;
    const request = requestRef.current;
    if (!serialNo || device.deviceType !== 'pro2') {
      setOffer(undefined);
      return;
    }
    void backgroundApiProxy.servicePrime
      .apiGetPrimeGiftEligibility({ serialNo })
      .then(
        (eligibility) => {
          if (request === requestRef.current)
            setOffer({ serialNo, eligibility });
        },
        () => {
          if (request === requestRef.current) setOffer(undefined);
        },
      );
  }, [device.deviceType, serialNo]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        requestRef.current += 1;
      };
    }, [refresh]),
  );
  useEffect(() => {
    const onRedeemed = (event: { serialNo: string }) => {
      if (event.serialNo === serialNo) {
        requestRef.current += 1;
        setOffer(undefined);
      }
    };
    appEventBus.on(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    };
  }, [serialNo]);
  if (!serialNo || offer?.serialNo !== serialNo || !offer.eligibility.canClaim)
    return null;
  return (
    <XStack
      testID={`pro2-prime-offer-${source}`}
      accessibilityRole="button"
      focusable
      alignItems="center"
      gap="$3"
      minHeight={88}
      p="$4"
      bg="$bgSubdued"
      borderRadius="$4"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() =>
        navigation.pushModal(EModalRoutes.PrimeModal, {
          screen: EPrimePages.PrimeGift,
          params: { device, serialNo, source },
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
          {message(ETranslationsMock.prime_gift_offer, {
            count: offer.eligibility.giftMonths,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {message(
            source === 'onboarding'
              ? ETranslationsMock.prime_gift_later
              : ETranslationsMock.prime_gift_device_once,
          )}
        </SizableText>
      </YStack>
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}
