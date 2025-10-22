import { useMemo } from 'react';

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

import { renderOnboardingHeaderRight } from '../components/HeaderRight';

export default function PickYourDevice() {
  const intl = useIntl();
  const DEVICES = useMemo(() => {
    return [
      {
        name: 'OneKey Pro',
        image: require('@onekeyhq/kit/assets/pick-pro.png'),
      },
      {
        name: 'OneKey Classic',
        tags: ['1S', '1S Pure'],
        image: require('@onekeyhq/kit/assets/pick-classic.png'),
      },
      {
        name: 'OneKey Touch',
        image: require('@onekeyhq/kit/assets/pick-touch.png'),
      },
      {
        name: 'OneKey Mini',
        image: require('@onekeyhq/kit/assets/pick-mini.png'),
      },
    ];
  }, []);
  return (
    <Page>
      <Page.Header
        title="Pick your device"
        headerRight={renderOnboardingHeaderRight}
      />
      <Page.Body>
        <YStack px="$10" bg="$bgApp" flex={1}>
          <XStack
            h="100%"
            flexWrap="wrap"
            gap="$px"
            bg="$neutral3"
            className="pick-device-clip-path"
          >
            {DEVICES.map(({ name, tags, image }) => (
              <YStack
                key={name}
                animateOnly={['backgroundColor']}
                animation="quick"
                flexGrow={1}
                flexBasis={0}
                minWidth="45%"
                bg="$bgApp"
                hoverStyle={{ bg: '$bgSubdued' }}
                onPress={() => {}}
                userSelect="none"
                p="$10"
                gap="$3"
                group
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
                  top="50%"
                  right="0"
                  style={{
                    transform: [{ translateY: '-50%' }],
                  }}
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
                    width={256}
                    height={256}
                    resizeMode="contain"
                  />
                </YStack>
              </YStack>
            ))}
          </XStack>
        </YStack>
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
      </Page.Body>
    </Page>
  );
}
