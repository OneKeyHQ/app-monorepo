import { StyleSheet } from 'react-native';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';

// Mock FAQ data structure
const FAQ_DATA = {
  title: {
    text: 'FAQs',
  },
  items: [
    {
      title: {
        text: 'How does Morpho USDC work on OneKey?',
      },
      description: {
        text: "Morpho USDC is managed by OneKey's third-party partner, Morpho. The yield process is executed through Morpho's smart contract system, and investments can be accessed and managed directly within the OneKey App.",
      },
    },
    {
      title: {
        text: 'What is Morpho?',
      },
      description: {
        text: 'Morpho is a decentralized, non-custodial protocol that enables earning yields and borrowing assets. It is permissionless, immutable, and cannot freeze assets under any circumstances. Morpho adopts a multi-layered security approach, has undergone top-tier audits, and offers a bug bounty program of up to $2.5 million—positioning it among the most secure protocols in the industry.',
      },
    },
    {
      title: {
        text: 'How is the performance fee calculated?',
      },
      description: {
        text: 'The performance fee is charged as a percentage of your actual realized profit, currently set at 15%. It does not affect your principal. Of this fee, OneKey charges 7%, and the vault manager charges 8%.\nExample: If you deposit $100 and earn a profit of $10, a $1.5 performance fee will be charged. You will receive $108.5 in total (principal + profit − performance fee).',
      },
    },
    {
      title: {
        text: 'What are the potential risks of using Earn?',
      },
      description: {
        text: 'While both the protocols and vault managers have implemented various security measures, interacting with third-party smart contracts inherently carries certain risks. These may include, but are not limited to, smart contract vulnerabilities, hacking incidents, insufficient liquidity, and extreme token price volatility.\nPlease make sure to fully understand and evaluate these risks before participating. OneKey shall not be held liable for any asset losses resulting from the aforementioned risks.',
      },
    },
  ],
};

export function FAQPanel() {
  return (
    <YStack gap="$4">
      <SizableText size="$headingLg">{FAQ_DATA.title.text}</SizableText>
      <YStack>
        <Accordion type="multiple" gap="$2">
          {FAQ_DATA.items.map(({ title, description }, index) => (
            <Accordion.Item value={String(index)} key={String(index)}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                my="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$headingSm"
                      color={open ? '$text' : '$textSubdued'}
                    >
                      {title.text}
                    </SizableText>
                    <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                      <Icon
                        name="ChevronDownSmallOutline"
                        color={open ? '$iconActive' : '$iconSubdued'}
                        size="$5"
                      />
                    </Stack>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pt="$2"
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  <SizableText
                    size="$bodyMd"
                    color="$text"
                    whiteSpace="pre-line"
                  >
                    {description.text}
                  </SizableText>
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}
