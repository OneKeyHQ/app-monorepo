import { useMemo } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function PickYourDevice() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const DEVICES = useMemo(() => {
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
    ];

    // Mini does not support Bluetooth, so hide it on native platforms
    if (platformEnv.isNative) {
      return devices.filter((device) => device.name !== 'OneKey Mini');
    }

    return devices;
  }, []);
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.pick_your_device,
          })}
        />
        <OnboardingLayout.Body scrollable={!gtMd} constrained={false}>
          <YStack
            gap="$5"
            $gtMd={{
              height: '100%',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '$px',
              bg: '$neutral3',
            }}
          >
            {DEVICES.map(({ name, tags, image, deviceType }) => (
              <YStack
                key={name}
                animateOnly={['backgroundColor']}
                animation="quick"
                p="$5"
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius="$5"
                borderCurve="continuous"
                minHeight="$56"
                $gtMd={{
                  flexGrow: 1,
                  flexBasis: 0,
                  minWidth: '45%',
                  p: '$10',
                  borderWidth: 0,
                  borderRadius: 0,
                }}
                bg="$bg"
                hoverStyle={{ bg: '$gray2' }}
                pressStyle={{ bg: '$gray3' }}
                userSelect="none"
                gap="$3"
                group
                onPress={() => {
                  void navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
                    deviceType,
                  });
                }}
              >
                <SizableText size="$headingXl" $gtMd={{ size: '$heading2xl' }}>
                  {name}
                </SizableText>
                {tags?.length ? (
                  <XStack gap="$2">
                    {tags.map((tag) => (
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
                ) : null}
                <YStack
                  position="absolute"
                  animation="quick"
                  animateOnly={['opacity', 'transform']}
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
                >
                  <Image
                    $group-hover={{
                      y: -4,
                    }}
                    style={{
                      transition:
                        'transform 150ms cubic-bezier(.455, .03, .515, .955)',
                    }}
                    source={image}
                    width="100%"
                    height="90%"
                    resizeMode="contain"
                  />
                </YStack>
              </YStack>
            ))}
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <XStack
            px="$5"
            py="$0.5"
            mt="auto"
            gap="$1"
            justifyContent="center"
            alignItems="center"
          >
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                // eslint-disable-next-line spellcheck/spell-checker
                id: ETranslations.global_onekey_prompt_dont_have_yet,
              })}
            </SizableText>
            <Anchor
              display="flex"
              color="$text"
              hoverStyle={{
                color: '$textSubdued',
              }}
              href="https://bit.ly/3YsKilK"
              target="_blank"
              size="$bodySm"
              hitSlop={{
                top: 8,
                left: 8,
                right: 8,
                bottom: 8,
              }}
              style={{
                textDecoration: 'none',
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_buy_one })}
            </Anchor>
          </XStack>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
