import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useNavigateToEarnReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import { useOnChainReward } from './hooks/useOnChainReward';
import { usePerpReward } from './hooks/usePerpReward';
import { RewardDetailTooltip } from './RewardDetailTooltip';

import type { IOnChainRewardProps } from './types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

export function OnChainReward({ onChain }: IOnChainRewardProps) {
  const { earnToken, onChainSummary, hasEarnRewards } = useOnChainReward({
    onChain,
  });
  const { perpToken, perpSummary, hasPerpRewards } = usePerpReward({ onChain });
  const navigateToEarnReward = useNavigateToEarnReward();
  const intl = useIntl();
  const showRewards = hasEarnRewards || hasPerpRewards;
  const toEarnRewardPage = useCallback(() => {
    navigateToEarnReward(onChain.title || '');
  }, [navigateToEarnReward, onChain.title]);

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="AtomOutline"
        title={onChain.title}
        description={intl.formatMessage({
          id: ETranslations.referral_onchain_desc,
        })}
        showChevron
        onPress={toEarnRewardPage}
      />
      {showRewards ? (
        <YStack gap="$3">
          {hasEarnRewards ? (
            <XStack gap="$2" ai="center" jc="space-between">
              <XStack gap="$2" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  DeFi
                </SizableText>
                <RewardDetailTooltip
                  rewards={onChain.available}
                  iconSize="$5"
                />
              </XStack>
              <Card.TokenValue
                tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
                amount={onChainSummary || 0}
                symbol={earnToken?.symbol || 'USDC'}
              />
            </XStack>
          ) : null}

          {hasPerpRewards ? (
            <XStack gap="$2" ai="center" jc="space-between">
              <XStack gap="$2" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_perp })}
                </SizableText>
              </XStack>
              <Card.TokenValue
                tokenImageUri={perpToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
                amount={perpSummary || 0}
                symbol={perpToken?.symbol || 'USDC'}
              />
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}
