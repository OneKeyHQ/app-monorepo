import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Card } from '../RewardCard';
import { FiatValue } from '../shared/FiatValue';
import { NoRewardYet } from '../shared/NoRewardYet';

import { useOnChainReward } from './hooks/useOnChainReward';
import { RewardDetailTooltip } from './RewardDetailTooltip';

import type { IOnChainRewardProps } from './types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

export function OnChainReward({ onChain }: IOnChainRewardProps) {
  const {
    earnToken,
    onChainSummary,
    onChainSummaryFiat,
    showRewards,
    toEarnRewardPage,
  } = useOnChainReward({ onChain });

  return (
    <Card.Container>
      <Card.Title
        icon="CoinsOutline"
        title={onChain.title}
        description={onChain.description}
        showChevron
        onPress={toEarnRewardPage}
      />
      {showRewards ? (
        <YStack gap="$2">
          <XStack>
            <Token
              size="xs"
              tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
            />
            <XStack pl="$2" pr="$3">
              <XStack gap="$1">
                <SizableText size="$bodyMd">≈</SizableText>
                <NumberSizeableText
                  formatter="value"
                  size="$bodyMd"
                  formatterOptions={{
                    tokenSymbol: 'USDC',
                  }}
                >
                  {onChainSummary}
                </NumberSizeableText>
              </XStack>
              <FiatValue fiatValue={onChainSummaryFiat} />
            </XStack>
            <RewardDetailTooltip rewards={onChain.available} iconSize="$5" />
          </XStack>
        </YStack>
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}
