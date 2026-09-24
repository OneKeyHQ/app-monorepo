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
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useIsFirstFocused } from '@onekeyhq/kit/src/hooks/useIsFirstFocused';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ONEKEY_BUY_HARDWARE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceManagementTestIDs } from '../../testIDs';

import type { ImageSourcePropType } from 'react-native';

const HeroImage =
  require('./assets/device_guide_hero.png') as ImageSourcePropType;

/** The hero PNG is cropped to its subject: 577 × 1256 px, 3× of the phone
 * size, transparent so it sits on either theme's page color. */
const HERO_ASPECT_RATIO = 577 / 1256;
/** Subject height in points. The design places the render in a 449 pt square
 * on phones and a 337 pt square on wide layouts; these are those squares minus
 * the render's transparent margins. */
const HERO_HEIGHT_PHONE = 419;
const HERO_HEIGHT_WIDE = 314;
/** Wide layouts pin the column below a fixed gap instead of centering the hero
 * in the free space. */
const WIDE_TOP_GAP = 100;
/** Bottom breathing room where no home-indicator inset exists (extension,
 * Android). Phones with an inset end the actions right above it. */
const MIN_BOTTOM_GAP = 20;

function Hero() {
  const { gtMd } = useMedia();
  const height = gtMd ? HERO_HEIGHT_WIDE : HERO_HEIGHT_PHONE;
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
      {/* Short phones shrink the render instead of pushing the words off. */}
      <Image
        source={HeroImage}
        width={Math.round(height * HERO_ASPECT_RATIO)}
        height={height}
        maxHeight="100%"
        flexShrink={1}
        resizeMode="contain"
      />
    </Stack>
  );
}

function DescriptionInfo() {
  const intl = useIntl();
  return (
    <YStack gap="$2" alignItems="center">
      <SizableText
        size="$heading4xl"
        color="$text"
        textAlign="center"
        $gtMd={{
          size: '$heading5xl',
        }}
      >
        {intl.formatMessage({
          id: ETranslations.global_no_device_connected,
        })}
      </SizableText>
      <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.global_no_device_connected_desc,
        })}
      </SizableText>
    </YStack>
  );
}

function ButtonContainer() {
  const intl = useIntl();
  const toOnBoardingPage = useNavigateToPickYourDevicePage();

  const onAddDevice = useCallback(() => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

  return (
    <YStack gap="$5" alignItems="center" testID="blank-page-actions">
      <Button
        size="large"
        variant="primary"
        borderRadius="$full"
        alignSelf="stretch"
        onPress={onAddDevice}
        testID={DeviceManagementTestIDs.connectHardwareBtn}
        $gtMd={{
          alignSelf: 'center',
        }}
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
  const { bottom } = useSafeAreaInsets();
  return (
    <YStack
      flex={1}
      w="100%"
      bg="$bgApp"
      px="$5"
      pb={Math.max(bottom, MIN_BOTTOM_GAP)}
      gap="$8"
      alignItems="center"
      testID="blank-page"
      $gtMd={{
        pt: WIDE_TOP_GAP,
        pb: '$5',
        justifyContent: 'flex-start',
      }}
    >
      <Hero />
      <YStack
        w="100%"
        gap="$8"
        alignItems="center"
        $gtMd={{
          w: 'auto',
        }}
      >
        <DescriptionInfo />
        <ButtonContainer />
      </YStack>
    </YStack>
  );
}

export function DeviceGuideView() {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <DeviceGuideViewContent /> : null;
}
