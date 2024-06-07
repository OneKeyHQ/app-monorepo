import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  EVideoResizeMode,
  Heading,
  Icon,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  Video,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const source = require('@onekeyhq/kit/assets/onboarding/onekey-all-products.mp4');

export function OneKeyHardwareWallet() {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  const handleBuyButtonPress = useCallback(async () => {
    const url = 'https://shop.onekey.so/';

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      alert(`Don't know how to open this URL: ${url}`);
    }
  }, []);

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.onboarding_onekey_hw })}
        headerTransparent
      />
      <Page.Body>
        <Video
          muted
          repeat
          source={source}
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
          <Stack p="$5" pt="$10">
            <LinearGradient
              colors={['transparent', '$blackA11']}
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
                focusStyle={{
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
