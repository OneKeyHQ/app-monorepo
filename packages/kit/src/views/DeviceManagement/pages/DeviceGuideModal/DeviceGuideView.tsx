import { useCallback } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useIsFirstFocused } from '@onekeyhq/kit/src/hooks/useIsFirstFocused';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ONEKEY_BUY_HARDWARE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DeviceManagementTestIDs } from '../../testIDs';

import type { ImageSourcePropType } from 'react-native';

const HeroImage =
  require('./assets/device_guide_hero.png') as ImageSourcePropType;

/** The hero PNG is cropped to its subject: 577 × 1256 px, 3× of the phone
 * size, transparent so it sits on either theme's page color. */
const HERO_ASPECT_RATIO = 577 / 1256;
/** Subject height in points. The design places the render in a square of
 * 449 pt on phones, 337 pt in the extension popup and 257 pt on wide layouts;
 * these are those squares minus the render's transparent margins. */
const HERO_HEIGHT_PHONE = 419;
const HERO_HEIGHT_EXTENSION = 314;
const HERO_HEIGHT_WIDE = 240;
/** Wide layouts center one narrow column in the page. */
const WIDE_COLUMN_MAX_WIDTH = 384;
/** Extra bottom room on wide layouts so the column reads as centered: the
 * render carries the visual weight, and it sits in the upper half. */
const WIDE_BOTTOM_GAP = 80;
/** Bottom breathing room where no home-indicator inset exists (extension,
 * Android). Phones with an inset end the actions right above it. */
const MIN_BOTTOM_GAP = 20;

/** The narrow-layout size is fixed per target; the wide size is a media
 * style so it switches together with the rest of the column when a window
 * crosses the breakpoint. */
const HERO_HEIGHT_NARROW = platformEnv.isExtension
  ? HERO_HEIGHT_EXTENSION
  : HERO_HEIGHT_PHONE;

function heroWidth(height: number) {
  return Math.round(height * HERO_ASPECT_RATIO);
}

function Hero() {
  return (
    <Stack
      flex={1}
      w="100%"
      alignItems="center"
      justifyContent="center"
      testID="blank-page-hero"
      $gtMd={{
        flex: 0,
      }}
    >
      {/* Short screens shrink the render instead of pushing the words off.
          minHeight 0 lets the web flex item go below its content height. */}
      <Stack
        width={heroWidth(HERO_HEIGHT_NARROW)}
        height={HERO_HEIGHT_NARROW}
        maxHeight="100%"
        minHeight={0}
        flexShrink={1}
        $gtMd={{
          width: heroWidth(HERO_HEIGHT_WIDE),
          height: HERO_HEIGHT_WIDE,
        }}
      >
        <Image
          source={HeroImage}
          width="100%"
          height="100%"
          resizeMode="contain"
        />
      </Stack>
    </Stack>
  );
}

function Actions() {
  const intl = useIntl();
  const toOnBoardingPage = useNavigateToPickYourDevicePage();

  const onAddDevice = useCallback(() => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

  return (
    <YStack w="100%" gap="$4" alignItems="center" testID="blank-page-actions">
      <Button
        w="100%"
        size="large"
        variant="primary"
        borderRadius="$full"
        icon="EnergyCircleSolid"
        onPress={onAddDevice}
        testID={DeviceManagementTestIDs.connectHardwareBtn}
      >
        {intl.formatMessage({
          id: ETranslations.global_connect_hardware_wallet,
        })}
      </Button>
      <XStack
        gap="$1"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_onekey_prompt_dont_have_yet,
          })}
        </SizableText>
        <Anchor
          size="$bodyMd"
          color="$textInteractive"
          hoverStyle={{
            color: '$textInteractiveHover',
          }}
          href={ONEKEY_BUY_HARDWARE_URL}
          target="_blank"
          testID={DeviceManagementTestIDs.buyOneKeyBtn}
        >
          {intl.formatMessage({ id: ETranslations.global_buy_one })}
        </Anchor>
      </XStack>
    </YStack>
  );
}

function DeviceGuideViewContent() {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  return (
    <YStack
      flex={1}
      w="100%"
      bg="$bgApp"
      alignItems="center"
      testID="blank-page"
    >
      <YStack
        flex={1}
        w="100%"
        px="$5"
        pb={Math.max(bottom, MIN_BOTTOM_GAP)}
        gap="$8"
        alignItems="center"
        $gtMd={{
          maxWidth: WIDE_COLUMN_MAX_WIDTH,
          justifyContent: 'center',
          pb: WIDE_BOTTOM_GAP,
        }}
      >
        <Hero />
        <YStack w="100%" gap="$8">
          {/* One centered paragraph; the page header already names the
              place, so there is no title to repeat it. */}
          <SizableText size="$bodyLg" color="$text" textAlign="center" px="$4">
            {intl.formatMessage({
              id: ETranslations.device_management_no_device__desc,
            })}
          </SizableText>
          <Actions />
        </YStack>
      </YStack>
    </YStack>
  );
}

export function DeviceGuideView() {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <DeviceGuideViewContent /> : null;
}
