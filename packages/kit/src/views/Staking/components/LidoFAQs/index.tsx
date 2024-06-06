import { useCallback, useState } from 'react';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';

type ILidoFAQProps = {
  question: string;
  answer: string;
};

const LidoFAQ = ({ question, answer }: ILidoFAQProps) => {
  const [show, setShow] = useState(false);
  const onToggle = useCallback(() => setShow((v) => !v), []);
  return (
    <YStack>
      <YStack>
        <XStack mb="$2" onPress={onToggle}>
          <XStack flex={1}>
            <SizableText size="$headingMd">{question}</SizableText>
          </XStack>
          <XStack>
            <IconButton
              variant="tertiary"
              icon={show ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
            />
          </XStack>
        </XStack>
        <XStack>
          {show ? <SizableText size="$bodyMd">{answer}</SizableText> : null}
        </XStack>
      </YStack>
    </YStack>
  );
};

export const EthLidoFAQs = () => (
  <YStack mt="$12">
    <XStack mb="$5">
      <SizableText size="$headingLg">FAQs</SizableText>
    </XStack>
    <YStack space="$5">
      <LidoFAQ
        question="How does the Lido protocol work?"
        answer="Lido provides an innovative solution to the hurdles presented by traditional PoS staking by effectively lowering barriers to entry and the costs associated with locking up one's assets in a single protocol. When a user deposits their assets to Lido, the tokens are staked on the Lido blockchain via the protocol."
      />
      <LidoFAQ
        question="Why do you receive stETH?"
        answer="When you deposit ETH into Lido, you receive Lido's liquid staking token, stETH, which represents your proportional claim to ETH in Lido. As validators operating on Lido receive rewards, you are eligible to receive rewards proportional to your stake, which is typically expected to occur daily."
      />
      <LidoFAQ
        question="What is the possible risk of Lido ?"
        answer="There is a certain risk in using Lido for staking, such as network or validator failures that may result in the loss of staked assets (penalties), or Lido smart contract vulnerabilities or errors. Although the code has been open-sourced, audited and widely covered, any cryptocurrency investment carries risks and needs to be evaluated independently."
      />
    </YStack>
  </YStack>
);

export const MaticLidoFAQs = () => (
  <YStack mt="$12">
    <XStack mb="$5">
      <SizableText size="$headingLg">FAQs</SizableText>
    </XStack>
    <YStack space="$5">
      <LidoFAQ
        question="How does the Lido protocol work?"
        answer="Lido provides an innovative solution to the hurdles presented by traditional PoS staking by effectively lowering barriers to entry and the costs associated with locking up one's assets in a single protocol. When a user deposits their assets to Lido, the tokens are staked on the Lido blockchain via the protocol."
      />
      <LidoFAQ
        question="Why do you receive stMATIC?"
        answer="When you deposit MATIC into Lido, you receive Lido's liquid staking token, stMATIC, which represents your proportional claim to MATIC in Lido. As validators operating on Lido receive rewards, you are eligible to receive rewards proportional to your stake, which is typically expected to occur dazily."
      />
      <LidoFAQ
        question="What is the possible risk of Lido ?"
        answer="There is a certain risk in using Lido for staking, such as network or validator failures that may result in the loss of staked assets (penalties), or Lido smart contract vulnerabilities or errors. Although the code has been open-sourced, audited and widely covered, any cryptocurrency investment carries risks and needs to be evaluated independently."
      />
    </YStack>
  </YStack>
);
