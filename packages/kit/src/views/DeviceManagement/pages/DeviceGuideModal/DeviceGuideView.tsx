import { useCallback, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  EVideoResizeMode,
  type IVideoProgressData,
  type IVideoSource,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  Video,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useIsFirstFocused } from '@onekeyhq/kit/src/hooks/useIsFirstFocused';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ONEKEY_BUY_HARDWARE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { DeviceManagementTestIDs } from '../../testIDs';

import type { ImageSourcePropType } from 'react-native';

const LightPosterImage =
  require('./assets/mydevice_hero_poster_light.jpg') as ImageSourcePropType;
const DarkPosterImage =
  require('./assets/mydevice_hero_poster_dark.jpg') as ImageSourcePropType;

/** How far the hero frame is lifted on phones (points). */
const MOBILE_HERO_LIFT = -64;
/** The video's own scale on wide layouts, where its square frame would
 * otherwise fill the height of the right three quarters of the page. The
 * frame is shown whole (contain) at page color, so no edge needs hiding —
 * provided the encode's background decodes to exactly the page color. */
const DESKTOP_HERO_SCALE = 0.85;

const LightVideoSource: IVideoSource = {
  uri: 'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media/onekey-pro2-showcase-light.mp4',
};
const DarkVideoSource: IVideoSource = {
  uri: 'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media/onekey-pro2-showcase-dark.mp4',
};

function VideoContainer() {
  const themeVariant = useThemeVariant();
  const { gtMd } = useMedia();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const videoSource = useMemo(() => {
    return themeVariant === 'dark' ? DarkVideoSource : LightVideoSource;
  }, [themeVariant]);

  const posterSource = useMemo(() => {
    return themeVariant === 'dark' ? DarkPosterImage : LightPosterImage;
  }, [themeVariant]);

  // Phones only: the web fade into the words below. Wide layouts show the
  // whole frame at page color, so nothing is left to fade.
  const maskStyle = useMemo(() => {
    if (gtMd) {
      return undefined;
    }
    const gradient = 'linear-gradient(180deg, transparent 15%, black 70%)';
    return {
      maskImage: gradient,
      WebkitMaskImage: gradient,
    };
  }, [gtMd]);

  const isVideoLoadedRef = useRef(isVideoLoaded);
  isVideoLoadedRef.current = isVideoLoaded;
  const handleVideoLoad = useCallback((e: IVideoProgressData) => {
    if (isVideoLoadedRef.current) {
      return;
    }
    if (e.currentTime > 0) {
      setIsVideoLoaded(true);
    }
  }, []);

  return (
    <Stack
      testID="blank-page-video"
      flex={1}
      w="100%"
      h="100%"
      bg="$bgApp"
      overflow="hidden"
      position="absolute"
      zIndex={0}
      top={-safeAreaTop}
      left={0}
      right={0}
      bottom="20%"
      $gtMd={{
        bottom: 0,
        left: '25%',
        top: 0,
        right: 0,
      }}
    >
      {/* Container with gradient mask. The showcase render centers the
          device in a square frame whose background is the page's own: on
          phones the frame is lifted so the device clears the words below,
          on wide layouts the video itself is shown whole and scaled down
          (scaling this container instead exposed the cover crop). */}
      <Stack
        position="absolute"
        width="100%"
        height="100%"
        y={MOBILE_HERO_LIFT}
        $gtMd={{
          y: 0,
        }}
        $platform-web={{
          ...maskStyle,
        }}
      >
        <Video
          muted
          autoPlay
          repeat
          rate={0.8}
          position="absolute"
          width="100%"
          height="100%"
          controls={false}
          playInBackground={false}
          resizeMode={gtMd ? EVideoResizeMode.CONTAIN : EVideoResizeMode.COVER}
          scale={gtMd ? DESKTOP_HERO_SCALE : 1}
          source={videoSource}
          onProgress={handleVideoLoad}
        />
        {!isVideoLoaded ? (
          <Image
            position="absolute"
            width="100%"
            height="100%"
            resizeMode={gtMd ? 'contain' : 'cover'}
            scale={gtMd ? DESKTOP_HERO_SCALE : 1}
            resizeWidth={480}
            source={posterSource}
          />
        ) : null}
        <LinearGradient
          colors={[
            'transparent',
            themeVariant === 'dark'
              ? 'rgba(15, 15, 15, 1)'
              : 'rgba(255, 255, 255, 1)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          height="70%"
          $platform-web={{
            display: 'none',
          }}
        />
      </Stack>
    </Stack>
  );
}

function DescriptionInfo() {
  const intl = useIntl();
  return (
    <YStack
      gap="$2"
      mb="$16"
      $gtMd={{
        mb: '$0',
      }}
    >
      <SizableText
        size="$heading4xl"
        textAlign="center"
        $gtMd={{
          size: '$heading5xl',
          textAlign: 'left',
        }}
        color="$text"
      >
        {intl.formatMessage({
          id: ETranslations.global_no_device_connected,
        })}
      </SizableText>
      <SizableText
        size="$bodyLg"
        textAlign="center"
        $gtMd={{
          size: '$bodyLg',
          textAlign: 'left',
        }}
        color="$textSubdued"
      >
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
  const { gtMd } = useMedia();

  const handleBuyButtonPress = useCallback(() => {
    openUrlExternal(ONEKEY_BUY_HARDWARE_URL);
  }, []);

  const onAddDevice = useCallback(async () => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

  if (gtMd) {
    return (
      <XStack gap="$3" flexDirection="row" justifyContent="flex-start">
        <Button
          size="medium"
          borderRadius="$full"
          variant="primary"
          onPress={onAddDevice}
          px="$4"
          testID={DeviceManagementTestIDs.connectHardwareBtn}
        >
          {intl.formatMessage({
            id: ETranslations.global_connect_hardware_wallet,
          })}
        </Button>
        <Button
          size="medium"
          borderRadius="$full"
          variant="secondary"
          borderWidth="$px"
          borderColor="$borderSubdued"
          bg="$neutral2"
          iconAfter="ArrowTopRightOutline"
          onPress={handleBuyButtonPress}
          px="$4"
          testID={DeviceManagementTestIDs.buyOneKeyBtn}
          $platform-web={{
            style: {
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            },
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })} OneKey
        </Button>
      </XStack>
    );
  }

  return (
    <YStack width="100%" gap="$4" py="$5" testID="blank-page-mobile-buttons">
      <Button
        size="large"
        variant="primary"
        onPress={onAddDevice}
        testID={DeviceManagementTestIDs.connectHardwareBtn}
      >
        {intl.formatMessage({
          id: ETranslations.global_connect_hardware_wallet,
        })}
      </Button>
      <XStack h="$9" justifyContent="center" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_onekey_prompt_dont_have_yet,
          })}
        </SizableText>
        <Anchor
          display="flex"
          color="$textInteractive"
          hoverStyle={{
            color: '$textInteractiveHover',
          }}
          href={ONEKEY_BUY_HARDWARE_URL}
          target="_blank"
          size="$bodyMdMedium"
          p="$2"
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
      w="100%"
      flex={1}
      gap="$8"
      bg="$bgApp"
      testID="blank-page"
      pb={bottom}
      zIndex={0}
    >
      <VideoContainer />

      <Page.Container flex={1} position="relative" zIndex={1}>
        <XStack
          h="100%"
          w="100%"
          justifyContent="space-between"
          alignItems={undefined}
          flexDirection="column-reverse"
          px="0px"
          $gtMd={{
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          <YStack
            gap="$0"
            maxWidth={undefined}
            alignItems={undefined}
            $gtMd={{
              gap: '$10',
              maxWidth: 480,
              alignItems: 'flex-start',
              marginTop: -48,
            }}
          >
            <DescriptionInfo />
            <ButtonContainer />
          </YStack>
        </XStack>
      </Page.Container>
    </YStack>
  );
}

export function DeviceGuideView() {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <DeviceGuideViewContent /> : null;
}
