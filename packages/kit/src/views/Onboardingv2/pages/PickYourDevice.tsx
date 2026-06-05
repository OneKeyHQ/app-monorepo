import { useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Image,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_BG_BORDER_COLOR,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ONEKEY_BUY_HARDWARE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { MOCK_PRO2_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/devicePro2Mock';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  LayoutHeader,
  LayoutHeaderBack,
  LayoutHeaderLanguageSelector,
  LayoutHeaderTitle,
} from '../components/Layout';
import { showOtherDevicesDialog } from '../components/OtherDevicesDialog';
import PixelShimmer from '../components/PixelShimmer';

// Neutral shimmer for the non-OneKey "use another device" card; OneKey device
// cards fall back to PixelShimmer's brand-green default.
const SHIMMER_NEUTRAL = ['#94A3B8', '#CBD5E1', '#A0AEC0'];

export default function PickYourDevice() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const DEVICES = useMemo<
    Array<{
      name: string;
      tags?: string[];
      deviceType: EDeviceType[];
      image: ReturnType<typeof require>;
      colors?: string[];
    }>
  >(() => {
    const devices = [
      {
        name: 'OneKey Pro 2',
        deviceType: [MOCK_PRO2_DEVICE_TYPE],
        image: require('@onekeyhq/kit/assets/pick-pro-2.png'),
      },
      {
        name: 'OneKey Pro',
        deviceType: [EDeviceType.Pro],
        image: require('@onekeyhq/kit/assets/pick-pro.png'),
      },
      {
        name: 'OneKey Classic',
        tags: ['1S', '1S Pure'],
        deviceType: [EDeviceType.Classic1s, EDeviceType.ClassicPure],
        image: require('@onekeyhq/kit/assets/pick-classic.png'),
      },
      {
        name: 'OneKey Touch',
        deviceType: [EDeviceType.Touch],
        image: require('@onekeyhq/kit/assets/pick-touch.png'),
      },
      {
        name: 'OneKey Mini',
        deviceType: [EDeviceType.Mini],
        image: require('@onekeyhq/kit/assets/pick-mini.png'),
      },
      {
        name: intl.formatMessage({ id: ETranslations.use_another_device }),
        tags: ['Ledger', 'Trezor'],
        deviceType: [],
        image: require('@onekeyhq/kit/assets/pick-others.png'),
        colors: SHIMMER_NEUTRAL,
      },
    ];

    // Mini does not support Bluetooth, so hide it on native platforms
    if (platformEnv.isNative) {
      return devices.filter((device) => device.name !== 'OneKey Mini');
    }

    return devices;
  }, [intl]);

  const scrollable = platformEnv.isNative || !gtMd;
  const { bottom: safeAreaBottom } = useSafeAreaInsets();

  const body = (
    <YStack flex={1} pt="$2" $gtMd={{ pt: 0 }}>
      <YStack
        gap="$5"
        flex={1}
        px="$5"
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0,
          px: 0,
        }}
      >
        {DEVICES.map(({ name, tags, image, deviceType, colors }) => (
          <YStack
            key={name}
            group="card"
            userSelect="none"
            $gtMd={{ flex: 1 }}
            onPress={() => {
              defaultLogger.onboarding.page.pickYourDevice(
                deviceType.length > 0 ? deviceType.join(',') : 'others',
              );
              if (deviceType.length === 0) {
                showOtherDevicesDialog();
                return;
              }
              void navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
                deviceType,
              });
            }}
          >
            <YStack
              p="$5"
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius="$5"
              borderCurve="continuous"
              minHeight="$56"
              bg="$bgSubdued"
              gap="$3"
              $gtMd={{
                flex: 1,
                p: '$6',
                pt: '$16',
                minHeight: 0,
                bg: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                gap: '$16',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Hover bg layer — no responsive overrides so
                  $group-card-* always wins over $gtMd cascade */}
              <Stack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                animation="quick"
                animateOnly={ANIMATE_ONLY_BG_BORDER_COLOR}
                pointerEvents="none"
                $gtMd={{
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderLeftColor: '$transparent',
                  borderRightColor: '$transparent',
                }}
                $group-card-hover={{
                  borderColor: '$borderSubdued',
                }}
              />
              {/* Clerk-style pixel shimmer on hover (web + desktop wide layout
                  only); renders null on native. Painted above the hover tint
                  but behind the device image and text. */}
              {gtMd ? <PixelShimmer colors={colors} /> : null}
              <YStack
                position="absolute"
                animation="medium"
                animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                enterStyle={{
                  opacity: 0,
                  y: 16,
                }}
                left="50%"
                top={0}
                right={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
                $group-card-hover={{ y: -4 }}
                $gtMd={{
                  position: 'relative',
                  left: 'auto',
                  right: 'auto',
                  top: 'auto',
                  bottom: 'auto',
                  w: 240,
                  h: 240,
                }}
              >
                <Image
                  source={image}
                  width="100%"
                  height="90%"
                  $gtMd={{ height: '100%' }}
                  resizeMode="contain"
                />
              </YStack>
              <YStack gap="$3" $gtMd={{ gap: '$5', alignItems: 'center' }}>
                <SizableText
                  textAlign="center"
                  size="$headingXl"
                  $gtMd={{ size: '$heading2xl' }}
                >
                  {name}
                </SizableText>
                <XStack gap="$2" $gtMd={{ minHeight: '$6' }}>
                  {tags?.map((tag) => (
                    <YStack
                      key={tag}
                      px="$2"
                      py="$1"
                      borderRadius="$1"
                      borderCurve="continuous"
                      borderWidth={1}
                      borderColor="$borderActive"
                    >
                      <SizableText size="$bodySmMedium">{tag}</SizableText>
                    </YStack>
                  ))}
                </XStack>
              </YStack>
            </YStack>
          </YStack>
        ))}
      </YStack>
    </YStack>
  );

  const buyFooter = (
    <XStack
      px="$5"
      pt="$3"
      pb={Math.max(safeAreaBottom, 12)}
      gap="$1"
      justifyContent="center"
      alignItems="center"
      pointerEvents="box-none"
      $gtMd={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        pb: '$8',
        zIndex: 2,
      }}
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          // oxlint-disable-next-line @cspell/spellchecker
          id: ETranslations.global_onekey_prompt_dont_have_yet,
        })}
      </SizableText>
      <Anchor
        display="flex"
        color="$text"
        hoverStyle={{
          color: '$textSubdued',
        }}
        href={ONEKEY_BUY_HARDWARE_URL}
        target="_blank"
        size="$bodyMd"
        hitSlop={{
          top: 8,
          left: 8,
          right: 8,
          bottom: 8,
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_buy_one })}
      </Anchor>
    </XStack>
  );

  return (
    <Page safeAreaEnabled={false}>
      <YStack
        $gtMd={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <LayoutHeader>
          <LayoutHeaderBack />
          <LayoutHeaderTitle>
            {intl.formatMessage({ id: ETranslations.pick_your_device })}
          </LayoutHeaderTitle>
          <LayoutHeaderLanguageSelector />
        </LayoutHeader>
      </YStack>
      {scrollable ? (
        <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {buyFooter}
    </Page>
  );
}
