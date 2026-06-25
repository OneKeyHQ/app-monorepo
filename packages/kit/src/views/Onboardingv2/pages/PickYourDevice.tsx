import { useCallback, useMemo } from 'react';

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
  useLiquidGlassHeaderTopInset,
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

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  LayoutHeader,
  LayoutHeaderBack,
  LayoutHeaderLanguageSelector,
  LayoutHeaderTitle,
} from '../components/Layout';
import { showOtherDevicesDialog } from '../components/OtherDevicesDialog';

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
    }>
  >(() => {
    const devices = [
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
  // iOS 26: host the header in the native Liquid Glass bar (like the other
  // onboarding pages) so the language switcher gets the system glass capsule
  // instead of a flat self-drawn pill.
  const useNativeHeader = platformEnv.isNativeIOS26Plus;
  // The transparent glass bar overlays the top of the content; reserve room for
  // it via the shared inset (consistent across all onboarding glass pages).
  const glassTopInset = useLiquidGlassHeaderTopInset();
  const bodyTopInset = useNativeHeader ? glassTopInset : undefined;
  const renderHeaderLanguage = useCallback(
    () => <LayoutHeaderLanguageSelector />,
    [],
  );
  const pickTitle = intl.formatMessage({ id: ETranslations.pick_your_device });

  const body = (
    <YStack
      flex={1}
      pt={bodyTopInset ?? '$2'}
      $gtMd={{ pt: bodyTopInset ?? 0 }}
    >
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
        {DEVICES.map(({ name, tags, image, deviceType }) => (
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
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Hover/press bg layer — no responsive overrides so
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
                  bg: '$bgHover',
                  borderColor: '$borderSubdued',
                }}
                $group-card-press={{
                  bg: '$bgActive',
                  borderColor: '$borderSubdued',
                }}
              />
              <YStack
                position="absolute"
                animation="quick"
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
                <SizableText size="$headingXl" $gtMd={{ size: '$heading2xl' }}>
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
      {useNativeHeader ? (
        // Deeper onboarding screen: the navigator supplies the native system
        // back (chevron); we only host the centered title + glass language
        // switcher in the native bar.
        <Page.Header
          headerTitleAlign="center"
          headerTitle={pickTitle}
          headerRight={renderHeaderLanguage}
        />
      ) : (
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
            <LayoutHeaderTitle>{pickTitle}</LayoutHeaderTitle>
            <LayoutHeaderLanguageSelector />
          </LayoutHeader>
        </YStack>
      )}
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
