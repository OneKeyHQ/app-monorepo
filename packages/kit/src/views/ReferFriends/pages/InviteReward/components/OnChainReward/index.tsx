import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import { useOnChainReward } from './hooks/useOnChainReward';
import { RewardDetailTooltip } from './RewardDetailTooltip';

import type { IOnChainRewardProps } from './types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

export function OnChainReward({ onChain }: IOnChainRewardProps) {
  const { earnToken, onChainSummary, showRewards, toEarnRewardPage } =
    useOnChainReward({ onChain });
  const intl = useIntl();

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="AtomSolid"
        title={onChain.title}
        description={intl.formatMessage({
          id: ETranslations.referral_onchain_desc,
        })}
        showChevron
        onPress={toEarnRewardPage}
      />
      {showRewards ? (
        <XStack gap="$2" ai="center" jc="space-between">
          <XStack gap="$2" ai="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              DeFi
            </SizableText>
            <RewardDetailTooltip rewards={onChain.available} iconSize="$5" />
          </XStack>
          <Card.TokenValue
            tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
            amount={onChainSummary || 0}
            symbol="USDC"
          />
        </XStack>
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}
