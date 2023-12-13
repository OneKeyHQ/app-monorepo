import { useState } from 'react';

import { AnimatePresence } from 'tamagui';

import type { IIconProps } from '@onekeyhq/components';
import {
  Heading,
  Icon,
  ListItem,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';

interface IWaningMessage {
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  message?: string;
}

const messages: IWaningMessage[] = [
  {
    icon: 'LockSolid',
    iconColor: '$iconInfo',
    message:
      'The recovery phrase alone gives you full access to your wallet and funds.',
  },
  {
    icon: 'InputSolid',
    iconColor: '$iconSuccess',
    message:
      'Forgot your password? Your recovery phrase restores access to your wallet',
  },
  {
    icon: 'CirclePlaceholderOffSolid',
    iconColor: '$iconCritical',
    message:
      'Protect your recovery phrase — never share it or input it into unauthorized apps.',
  },
  {
    icon: 'ShieldCheckDoneSolid',
    iconColor: '$icon',
    message:
      'Reminder, OneKey Support will never request your recovery phrase.',
  },
];

const phrases: string[][] = [
  ['abandon', 'ability', 'able', 'about', 'above', 'absent'],
  ['absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'],
];

export function ShowRecoveryPhrase() {
  const [isShowPhrase, setIsShowPhrase] = useState(false);

  return (
    <Page safeAreaEnabled>
      <Page.Header />
      <Page.Body
        $gtMd={{
          pt: '$8',
        }}
      >
        <AnimatePresence>
          {!isShowPhrase && (
            <Stack
              key="message"
              animation="quick"
              maxWidth={480}
              mx="auto"
              exitStyle={{
                opacity: 0,
                x: -16,
              }}
            >
              <Stack
                borderRadius="$full"
                p="$3"
                bg="$bgCaution"
                alignSelf="center"
              >
                <Icon name="ErrorSolid" size="$8" color="$iconCaution" />
              </Stack>
              <Heading pt="$5" pb="$3" size="$headingXl" textAlign="center">
                Before you proceed
              </Heading>
              {messages.map((item) => (
                <ListItem
                  alignItems="flex-start"
                  key={item.message}
                  icon={item.icon}
                  iconProps={{
                    color: item.iconColor,
                  }}
                  title={item.message}
                  titleProps={{
                    size: '$bodyLg',
                  }}
                  minHeight="auto"
                />
              ))}
            </Stack>
          )}

          {isShowPhrase && (
            <Stack
              key="phrase"
              animation="quick"
              enterStyle={{
                x: 16,
                opacity: 0,
              }}
              px="$5"
            >
              <Heading pt="$5" pb="$3" size="$headingXl" textAlign="center">
                Write down your phrases in order
              </Heading>
              <XStack
                onPress={() => Toast.success({ title: 'Copied' })}
                $gtMd={{
                  w: '$80',
                  mx: 'auto',
                }}
                mt="$2"
                mb="$4"
                borderRadius="$3"
                bg="$bgStrong"
                style={{
                  borderCurve: 'continuous',
                }}
              >
                {phrases.map((group, groupIndex) => (
                  <Stack key={groupIndex} flexBasis="50%" px="$3" py="$1.5">
                    {group.map((phrase, index) => (
                      <XStack key={phrase} p="$2">
                        <SizableText
                          userSelect="none"
                          minWidth="$6"
                          mr="$0.5"
                          color="$textSubdued"
                        >
                          {groupIndex === 0
                            ? index + 1
                            : index + 1 + group.length}
                          .
                        </SizableText>
                        <SizableText
                          userSelect="none"
                          size="$bodyLgMedium"
                          flex={1}
                          style={{
                            wordBreak: 'break-all',
                          }}
                        >
                          {phrase}
                        </SizableText>
                      </XStack>
                    ))}
                  </Stack>
                ))}
              </XStack>
              <XStack justifyContent="center" alignItems="center">
                <Icon name="ArrowTopOutline" size="$4.5" color="$iconSubdued" />
                <SizableText px="$1" color="$textSubdued">
                  Click above to copy
                </SizableText>
                <Icon name="ArrowTopOutline" size="$4.5" color="$iconSubdued" />
              </XStack>
            </Stack>
          )}
        </AnimatePresence>
      </Page.Body>
      <Page.Footer
        onConfirmText={
          !isShowPhrase ? 'Show Recovery Phrase' : "I've Saved the Phrase"
        }
        onConfirm={() => setIsShowPhrase(true)}
      />
    </Page>
  );
}
