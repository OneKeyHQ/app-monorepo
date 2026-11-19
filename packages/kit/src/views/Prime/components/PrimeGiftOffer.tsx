import { useCallback, useEffect, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  HeightTransition,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  CARD_ROW_CHEVRON_PROPS,
  CARD_SURFACE_RADIUS,
  useCardShadow,
} from '@onekeyhq/kit/src/hooks/useCardSurface';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { usePrimeGiftEligibilityPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EPrimeGiftPages,
  type IPrimeGiftParamList,
} from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { getPrimeGiftDurationText } from '../hooks/primeGiftDuration';
import { usePrimeGiftOfferImpression } from '../hooks/usePrimeGiftOfferImpression';

// Stable identity: HeightTransition memoizes its style prop.
const fullWidthStyle = {
  width: '100%',
} as const;

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
  const cardShadow = useCardShadow();
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
  const isEligible = Boolean(
    serialNo && eligibility?.eligible && eligibility.hasUnclaimedGift,
  );
  // First frame for this serial. Onboarding always grows into an already
  // visible page. Device details grows only when eligibility arrives later,
  // so a cached offer does not push the sections below on every open.
  const appearanceRef = useRef<{
    serialNo: string | undefined;
    eligible: boolean;
  } | null>(null);
  let appearance = appearanceRef.current;
  if (!appearance || appearance.serialNo !== serialNo) {
    appearance = { serialNo, eligible: isEligible };
    appearanceRef.current = appearance;
  }
  const shouldAnimateEnter = source === 'onboarding' || !appearance.eligible;
  const impressionRef = usePrimeGiftOfferImpression({
    enabled: isEligible,
    serialNo,
    source,
  });
  if (!serialNo || !eligibility?.eligible || !eligibility.hasUnclaimedGift) {
    return null;
  }
  // On the device page the offer sits among raised settings cards, so it
  // takes their surface instead of a grey block; onboarding keeps its own.
  const onDevicePage = source === 'deviceDetails';
  const card = (
    <XStack
      ref={impressionRef}
      testID={`prime-gift-offer-${source}`}
      accessibilityRole="button"
      focusable
      alignItems="center"
      gap="$3"
      minHeight={onDevicePage ? 64 : 88}
      w="100%"
      pl={onDevicePage ? '$3' : '$4'}
      pr={onDevicePage ? '$4' : '$5'}
      py={onDevicePage ? '$3' : '$4'}
      bg={onDevicePage ? '$bgApp' : '$bgSubdued'}
      borderRadius={onDevicePage ? CARD_SURFACE_RADIUS : '$4'}
      style={onDevicePage ? { boxShadow: cardShadow } : undefined}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => {
        defaultLogger.prime.subscription.primeGiftOfferClick({ source });
        const params: IPrimeGiftParamList[EPrimeGiftPages.PrimeGift] = {
          device: deviceUtils.dbDeviceToSearchDevice(device),
          serialNo,
          source,
          onboardingRouteKey,
        };
        // Android onboarding stays on the dark stack so the first native
        // frame and close/pop never expose the light root-modal surface.
        if (platformEnv.isNativeAndroid && source === 'onboarding') {
          navigation.push(EPrimeGiftPages.PrimeGift, params);
          return;
        }
        navigation.pushModal(EModalRoutes.PrimeGiftModal, {
          screen: EPrimeGiftPages.PrimeGift,
          params,
        });
      }}
    >
      <Stack
        w={onDevicePage ? 40 : undefined}
        h={onDevicePage ? 40 : undefined}
        borderRadius={onDevicePage ? 10 : undefined}
        bg={onDevicePage ? '$bgSubdued' : undefined}
        ai="center"
        jc="center"
        flexShrink={0}
      >
        <Icon
          name={
            theme === 'light'
              ? 'OnekeyPrimeLightColored'
              : 'OnekeyPrimeDarkColored'
          }
          size="$6"
        />
      </Stack>
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText
          size={onDevicePage ? '$headingSm' : '$bodyLgMedium'}
          cursor="default"
          userSelect="none"
        >
          {intl.formatMessage(
            { id: ETranslations.prime_gift_claim_duration__action },
            { duration: getPrimeGiftDurationText(eligibility, intl) },
          )}
        </SizableText>
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          cursor="default"
          userSelect="none"
        >
          {intl.formatMessage({
            id:
              source === 'onboarding'
                ? ETranslations.prime_gift_later__desc
                : ETranslations.prime_gift_device_once__desc,
          })}
        </SizableText>
      </YStack>
      {/* Match ListItem.DrillIn's default 24dp ($6 shrinks on narrow Android
          screens); on the device page, match its rows' smaller chevron. */}
      <Icon
        name="ChevronRightSmallOutline"
        color="$iconSubdued"
        mr="$-1.5"
        flexShrink={0}
        {...(onDevicePage ? CARD_ROW_CHEVRON_PROPS : {})}
      />
    </XStack>
  );
  const frameProps =
    source === 'onboarding'
      ? {
          w: '100%' as const,
          $gtMd: { w: 400 },
        }
      : {
          w: '100%' as const,
        };
  if (shouldAnimateEnter) {
    return (
      <YStack {...frameProps}>
        <HeightTransition
          duration={300}
          roundHeightToNearestPixel={platformEnv.isNativeIOS}
          style={fullWidthStyle}
        >
          <YStack pt="$8" w="100%">
            {card}
          </YStack>
        </HeightTransition>
      </YStack>
    );
  }
  return (
    <YStack pt="$8" {...frameProps}>
      {card}
    </YStack>
  );
}
