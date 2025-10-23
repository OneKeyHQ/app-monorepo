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
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function PickYourDevice() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const DEVICES = useMemo(() => {
    return [
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
  }, []);
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Pick your device" />
        <OnboardingLayout.Body scrollable={false} constrained={false}>
          <XStack h="100%" flexWrap="wrap" gap="$px" bg="$neutral3">
            {DEVICES.map(({ name, tags, image, deviceType }) => (
              <YStack
                key={name}
                animateOnly={['backgroundColor']}
                animation="quick"
                flexGrow={1}
                flexBasis={0}
                minWidth="45%"
                bg="$bgApp"
                hoverStyle={{ bg: '$bgSubdued' }}
                userSelect="none"
                p="$10"
                gap="$3"
                group
                onPress={() => {
                  void navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
                    deviceType,
                  });
                }}
              >
                <SizableText size="$heading2xl">{name}</SizableText>
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
                  w="50%"
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
                    height="100%"
                    resizeMode="contain"
                  />
                </YStack>
              </YStack>
            ))}
          </XStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <XStack
            px="$5"
            py="$0.5"
            mt="auto"
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
              p="$2"
              pl="$0"
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
