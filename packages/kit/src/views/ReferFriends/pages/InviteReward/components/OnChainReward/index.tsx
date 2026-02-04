import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToEarnReward } from '../../../EarnReward/hooks/useNavigateToEarnReward';
import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import { useOnChainReward } from './hooks/useOnChainReward';

import type { IOnChainRewardProps } from './types';

const DEFAULT_EARN_IMAGE_URL =
  'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png';

export function OnChainReward({ onChain }: IOnChainRewardProps) {
  const { earnToken, onChainSummary, hasEarnRewards } = useOnChainReward({
    onChain,
  });
  const navigateToEarnReward = useNavigateToEarnReward();
  const intl = useIntl();
  const toEarnRewardPage = useCallback(() => {
    navigateToEarnReward(onChain.title || '');
  }, [navigateToEarnReward, onChain.title]);

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="CoinsOutline"
        title="DeFi"
        description={intl.formatMessage({
          id: ETranslations.referral_onchain_desc,
        })}
        showChevron
        onPress={toEarnRewardPage}
      />
      {hasEarnRewards ? (
        <Card.Item
          label={intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
          value={
            <Card.TokenValue
              tokenImageUri={earnToken?.logoURI || DEFAULT_EARN_IMAGE_URL}
              amount={onChainSummary || 0}
              symbol={earnToken?.symbol || 'USDC'}
            />
          }
        />
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}
