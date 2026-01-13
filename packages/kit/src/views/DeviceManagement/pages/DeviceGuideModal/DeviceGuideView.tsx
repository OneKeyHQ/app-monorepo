import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import {
  Anchor,
  Button,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ONEKEY_BUY_HARDWARE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

const MobileLightImageUri =
  'https://tk5fwf4sqe0lektj.public.blob.vercel-storage.com/NNFC5F4XNCJREFJBVU7AJYC9/mobile_w.png';
const DesktopLightImageUri =
  'https://tk5fwf4sqe0lektj.public.blob.vercel-storage.com/NNFC5F4XNCJREFJBVU7AJYC9/web_w.png';

const MobileDarkImageUri =
  'https://tk5fwf4sqe0lektj.public.blob.vercel-storage.com/NNFC5F4XNCJREFJBVU7AJYC9/mobile_b.png';
const DesktopDarkImageUri =
  'https://tk5fwf4sqe0lektj.public.blob.vercel-storage.com/NNFC5F4XNCJREFJBVU7AJYC9/web_b.png';

function ImageContainer() {
  const { gtMd } = useMedia();
  const themeVariant = useThemeVariant();

  let imageUrl;
  if (themeVariant === 'dark') {
    imageUrl = gtMd ? DesktopDarkImageUri : MobileDarkImageUri;
  } else {
    imageUrl = gtMd ? DesktopLightImageUri : MobileLightImageUri;
  }

  return (
    <Stack
      testID="blank-page-image"
      flex={1}
      w="100%"
      h="100%"
      bg="$bgApp"
      overflow="hidden"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom="20%"
      $gtMd={{
        bottom: 0,
        left: 0,
        top: 0,
        right: 0,
      }}
      $gt2Md={{
        left: '8%',
      }}
      $gtLg={{
        left: '15%',
      }}
    >
      <Image
        // key={imageKey}
        width="100%"
        height="100%"
        resizeMode="cover"
        source={{ uri: imageUrl }}
      />
    </Stack>
  );
}

function DescriptionInfo() {
  const intl = useIntl();
  return (
    <YStack
      gap="$4"
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
  const appNavigation = useAppNavigation();
  const { gtMd } = useMedia();

  const handleBuyButtonPress = useCallback(async () => {
    const url = ONEKEY_BUY_HARDWARE_URL;

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      alert(`Don't know how to open this URL: ${url}`);
    }
  }, []);

  const onAddDevice = useCallback(async () => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [appNavigation]);

  if (gtMd) {
    return (
      <XStack
        gap="$3"
        flexWrap="wrap"
        flexDirection="row"
        justifyContent="flex-start"
      >
        <Button
          size="medium"
          borderRadius="$full"
          variant="primary"
          minWidth={160}
          onPress={onAddDevice}
        >
          {intl.formatMessage({
            id: ETranslations.global_connect_hardware_wallet,
          })}
        </Button>
        <Button
          size="medium"
          borderRadius="$full"
          variant="secondary"
          minWidth={160}
          borderWidth="$px"
          borderColor="$borderSubdued"
          bg="$transparent"
          iconAfter="ArrowTopRightOutline"
          onPress={handleBuyButtonPress}
        >
          {intl.formatMessage({ id: ETranslations.global_buy_one })}
        </Button>
      </XStack>
    );
  }

  return (
    <YStack width="100%" gap="$4" p="$5" testID="blank-page-mobile-buttons">
      <Button size="large" variant="primary" onPress={onAddDevice}>
        {intl.formatMessage({
          id: ETranslations.global_connect_hardware_wallet,
        })}
      </Button>
      <XStack h="$9" px="$5" justifyContent="center" alignItems="center">
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

export function DeviceGuideView() {
  return (
    <YStack w="100%" h="100%" gap="$8" bg="$bgApp" testID="blank-page">
      <ImageContainer />

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
          px: '10%',
        }}
      >
        <YStack
          gap="$0"
          maxWidth={undefined}
          alignItems={undefined}
          $gtMd={{
            gap: '$10',
            maxWidth: 400,
            alignItems: 'flex-start',
          }}
        >
          <DescriptionInfo />
          <ButtonContainer />
        </YStack>
      </XStack>
    </YStack>
  );
}
