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

import type { ColorTokens } from 'tamagui';

interface IWaningMessage {
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  iconContainerColor?: ColorTokens;
  message?: string;
}

const messages: IWaningMessage[] = [
  {
    icon: 'LockOutline',
    iconColor: '$iconInfo',
    iconContainerColor: '$bgInfo',
    message:
      'The recovery phrase alone gives you full access to your wallets and funds.',
  },
  {
    icon: 'InputOutline',
    iconColor: '$iconSuccess',
    iconContainerColor: '$bgSuccess',
    message:
      'If you forget your password, you can use the recovery phrase to get back into your wallet.',
  },
  {
    icon: 'EyeOffOutline',
    iconColor: '$iconCritical',
    iconContainerColor: '$bgCritical',
    message: 'Never share it with anyone or enter it into any form.',
  },
  {
    icon: 'ShieldCheckDoneOutline',
    iconColor: '$iconCaution',
    iconContainerColor: '$bgCaution',
    message: 'OneKey Support will never ask for your recovery phrase.',
  },
];

const phrases: string[][] = [
  ['abandon', 'ability', 'able', 'about', 'above', 'absent'],
  ['absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'],
];

export function ShowRecoveryPhrase() {
  const [isShowPhrase, setIsShowPhrase] = useState(false);

  return (
    <Page>
      <Page.Header />
      <Page.Body>
        <Heading
          pt="$2"
          pb="$4"
          px="$6"
          maxWidth="$96"
          size="$heading3xl"
          $md={{ size: '$heading2xl' }}
        >
          Read the following, then save the phrase securely.
        </Heading>
        {messages.map((item) => (
          <ListItem key={item.message}>
            <Stack
              p="$2"
              borderRadius="$3"
              bg={item.iconContainerColor}
              style={{
                borderCurve: 'continuous',
              }}
            >
              <Icon name={item.icon} color={item.iconColor} />
            </Stack>
            <ListItem.Text
              flex={1}
              primary={item.message}
              primaryTextProps={{
                size: '$bodyLg',
              }}
            />
          </ListItem>
        ))}
        <AnimatePresence>
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
