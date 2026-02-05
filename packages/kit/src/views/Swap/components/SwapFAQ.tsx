import { useMemo } from 'react';

import {
  Accordion,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';

type IFAQItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: IFAQItem[] = [
  {
    question: 'What is OneKey Swap?',
    answer:
      'OneKey Swap is a DEX aggregator that searches across 400+ decentralized exchanges and liquidity sources to find you the best rates. Our smart routing technology automatically splits and routes your trade for optimal execution.',
  },
  {
    question: 'How does OneKey find the best price?',
    answer:
      'Our algorithm compares quotes from hundreds of DEXs and liquidity pools in real-time. When beneficial, it splits your order across multiple sources to minimize slippage and maximize the amount you receive.',
  },
  {
    question: 'What are the fees?',
    answer:
      'OneKey charges a 0.3% service fee on swaps. Stablecoin-to-stablecoin swaps are completely free (0% fee). Network gas fees are separate and paid directly to the blockchain.',
  },
  {
    question: 'What is slippage?',
    answer:
      'Slippage is the difference between the expected price and actual execution price, caused by market movements during transaction processing. You can adjust slippage tolerance in settings. Default is 0.5%, which works for most trades.',
  },
  {
    question: 'What is MEV protection?',
    answer:
      'MEV (Maximal Extractable Value) protection shields your transactions from front-running bots that profit by manipulating transaction order. OneKey provides built-in MEV protection on Ethereum, Solana, BSC, and other supported networks.',
  },
  {
    question: 'Why did my swap fail?',
    answer:
      'Common reasons include: price moved beyond your slippage tolerance, insufficient gas fees, token contract restrictions, or network congestion. Try increasing slippage tolerance, adjusting gas fees, or waiting for network conditions to improve.',
  },
  {
    question: 'What is token approval?',
    answer:
      'Before swapping a token for the first time, you must approve the smart contract to access it. You can choose unlimited approval (convenient, one-time) or exact amount (more secure, requires approval each time). Approvals can be revoked in settings.',
  },
];

function SwapFAQ() {
  const faqItems = useMemo(() => FAQ_ITEMS, []);

  return (
    <YStack gap="$4">
      <SizableText size="$heading2xl" color="$text" fontWeight="600">
        FAQ
      </SizableText>
      <YStack>
        <Accordion type="multiple">
          {faqItems.map(({ question, answer }, index) => (
            <YStack key={String(index)}>
              {index > 0 ? (
                <Stack height={1} bg="$borderSubdued" my="$2" />
              ) : null}
              <Accordion.Item value={String(index)}>
                <Accordion.Trigger
                  unstyled
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="space-between"
                  borderWidth={0}
                  bg="$transparent"
                  p={0}
                  py="$5"
                  m={0}
                  cursor="pointer"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <SizableText
                        textAlign="left"
                        flex={1}
                        size="$headingLg"
                        color="$text"
                        pr="$2"
                      >
                        {question}
                      </SizableText>
                      <Stack
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color="$iconSubdued"
                          size="$6"
                        />
                      </Stack>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator animation="quick">
                  <Accordion.Content
                    unstyled
                    p={0}
                    pt="$1"
                    pb="$5"
                    pr="$8"
                    animation="100ms"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  >
                    <SizableText size="$bodyLg" color="$textSubdued">
                      {answer}
                    </SizableText>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            </YStack>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  );
}

export default SwapFAQ;
