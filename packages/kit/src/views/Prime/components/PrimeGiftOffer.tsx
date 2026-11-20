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
  CARD_SURFACE_BG,
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

// The card's ring, and in light its soft shadow, draws up to 10px outside it,
// where the height transition's clip would cut it off. The transition reaches
// that far past the card at the sides and below, and its content pads the
// same back, so the layout does not move. Stable identity: HeightTransition
// memoizes its style prop.
const SHADOW_BLEED = 12;
const transitionStyle = {
  alignSelf: 'stretch',
  marginHorizontal: -SHADOW_BLEED,
  marginBottom: -SHADOW_BLEED,
} as const;

// On the device page the offer sits among settings rows and reads a step
// above them; phones set those rows at 16.
const DEVICE_PAGE_TITLE_SIZE = platformEnv.isNative
  ? '$headingMd'
  : '$headingSm';

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
  // Both pages show the offer on the raised surface of the device page's
  // settings cards, its logo on a tile.
  const onDevicePage = source === 'deviceDetails';
  const card = (
    <XStack
      ref={impressionRef}
      testID={`prime-gift-offer-${source}`}
      accessibilityRole="button"
      focusable
      alignItems="center"
      gap="$3"
      minHeight={64}
      w="100%"
      pl="$3"
      pr="$4"
      py="$3"
      bg={CARD_SURFACE_BG}
      borderRadius={CARD_SURFACE_RADIUS}
      style={{ boxShadow: cardShadow }}
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
      {/* A tint rather than a fill, so the tile reads on the card's white and
          on its dark grey alike. */}
      <Stack
        w={40}
        h={40}
        borderRadius={10}
        bg="$neutral2"
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
          size={onDevicePage ? DEVICE_PAGE_TITLE_SIZE : '$bodyLgMedium'}
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
      {/* The settings cards' row chevron, a size down from ListItem's. */}
      <Icon
        name="ChevronRightSmallOutline"
        color="$iconSubdued"
        mr="$-1.5"
        flexShrink={0}
        {...CARD_ROW_CHEVRON_PROPS}
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
          style={transitionStyle}
        >
          <YStack pt="$8" px={SHADOW_BLEED} pb={SHADOW_BLEED} w="100%">
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
