import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking, StyleSheet, useWindowDimensions } from 'react-native';

import {
  EPageType,
  EVideoResizeMode,
  Heading,
  Icon,
  LinearGradient,
  NavBackButton,
  Page,
  SizableText,
  Stack,
  Video,
  XStack,
  usePageType,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Displays a full-screen promotional page for the OneKey hardware wallet with a video background, localized text, and a button to purchase the device.
 *
 * The component adapts its layout for different platforms and screen sizes, and handles navigation and safe area insets. Pressing the purchase button attempts to open the OneKey purchase URL in the device's browser.
 */
export function OneKeyHardwareWallet() {
  const { bottom, top } = useSafeAreaInsets();
  const intl = useIntl();

  const handleBuyButtonPress = useCallback(async () => {
    const url = 'https://bit.ly/3YtpXgh';

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      alert(`Don't know how to open this URL: ${url}`);
    }
  }, []);

  const { width } = useWindowDimensions();

  const navigation = useAppNavigation();

  const popPage = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const pageType = usePageType();
  const theme = useTheme();
  const blackA11Color = theme.blackA11.val;
  const transparentColor = theme.transparent.val;
  return (
    <Page safeAreaEnabled={false}>
      <Page.Body>
        <Video
          muted
          repeat
          source={{
            uri: 'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media/onekey-all-products.05e87080767d0733c1f4.mp4',
          }}
          flex={1}
          resizeMode={EVideoResizeMode.COVER}
          controls={false}
          playInBackground={false}
        />
        <Stack
          position="absolute"
          left={0}
          top={0}
          right={0}
          bottom={0}
          zIndex={1}
          justifyContent="flex-end"
        >
          <XStack
            position="absolute"
            h={64}
            w={width}
            top={
              platformEnv.isNativeIOS &&
              top > 0 &&
              pageType === EPageType.fullScreen
                ? 36
                : 0
            }
            px={16}
            ai="center"
            $platform-ios={{
              jc: 'center',
            }}
          >
            <NavBackButton
              iconProps={{ color: '$whiteA12' }}
              onPress={popPage}
              $platform-ios={{
                position: 'absolute',
                left: 16,
              }}
            />
            <SizableText size="$headingLg" mx={14} color="$whiteA12">
              {intl.formatMessage({ id: ETranslations.onboarding_onekey_hw })}
            </SizableText>
          </XStack>
          <Stack p="$5" pt="$10">
            <LinearGradient
              colors={[transparentColor, blackA11Color]}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
              zIndex={-1}
            />
            <Stack
              alignItems="flex-start"
              pb={bottom}
              $gtMd={{
                maxWidth: '$100',
              }}
            >
              <Heading size="$heading4xl" color="$whiteA12">
                {intl.formatMessage({
                  id: ETranslations.onboarding_onekey_hw_intro_title,
                })}
              </Heading>
              <SizableText pt="$3" pb="$6" color="$whiteA11">
                {intl.formatMessage({
                  id: ETranslations.onboarding_onekey_hw_intro_desc,
                })}
              </SizableText>
              <XStack
                justifyContent="center"
                alignItems="center"
                py="$4"
                px="$12"
                w="100%"
                $gtMd={{
                  px: '$5',
                  py: '$2',
                  w: 'auto',
                }}
                bg="$whiteA3"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$whiteA4"
                borderRadius="$3"
                hoverStyle={{
                  bg: '$whiteA4',
                }}
                pressStyle={{
                  bg: '$whiteA5',
                }}
                borderCurve="continuous"
                focusVisibleStyle={{
                  outlineColor: '$whiteA6',
                  outlineStyle: 'solid',
                  outlineOffset: 2,
                  outlineWidth: 2,
                }}
                userSelect="none"
                onPress={handleBuyButtonPress}
              >
                <Icon name="BagSmileOutline" color="$whiteA12" size="$5" />
                <SizableText color="$whiteA12" pl="$2.5" size="$bodyLgMedium">
                  {intl.formatMessage({
                    id: ETranslations.global_buy_one,
                  })}
                </SizableText>
              </XStack>
            </Stack>
          </Stack>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default OneKeyHardwareWallet;
