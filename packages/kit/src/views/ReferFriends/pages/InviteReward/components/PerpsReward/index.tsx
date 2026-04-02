import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Popover,
  SizableText,
  Tooltip,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToPerpsReward } from '../../../PerpsReward/hooks/useNavigateToPerpsReward';
import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IPerpsRewardProps } from './types';

function ZeroFeeBadge() {
  const intl = useIntl();
  const { gtMd } = useMedia();

  const badge = (
    <Badge badgeType="success" badgeSize="sm">
      <Badge.Text>
        {intl.formatMessage({ id: ETranslations.referral_perps_0_fee_badge })}
      </Badge.Text>
    </Badge>
  );

  if (!gtMd) {
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee,
        })}
        renderTrigger={badge}
        renderContent={
          <YStack px="$5" py="$4">
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.referral_perps_0_fee,
              })}
            </SizableText>
          </YStack>
        }
      />
    );
  }

  return (
    <Tooltip
      renderTrigger={badge}
      renderContent={intl.formatMessage({
        id: ETranslations.referral_perps_0_fee,
      })}
    />
  );
}

export function PerpsReward({ perpsCumulativeRewards }: IPerpsRewardProps) {
  const intl = useIntl();
  const navigateToPerpsReward = useNavigateToPerpsReward();
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp.getPerpData().then((config) => {
      setBuilderFeeRate(config.hyperliquidMaxBuilderFee);
    });
  }, []);

  const hasReward =
    perpsCumulativeRewards &&
    new BigNumber(perpsCumulativeRewards.undistributedReward).isGreaterThan(0);

  const handlePress = () => {
    void navigateToPerpsReward();
  };

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="TradeOutline"
        title={intl.formatMessage({ id: ETranslations.global_perp })}
        description={intl.formatMessage({
          id: ETranslations.referral_perps_description,
        })}
        onPress={handlePress}
        badge={builderFeeRate === 0 ? <ZeroFeeBadge /> : undefined}
      />
      {hasReward ? (
        <Card.Item
          label={intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
          value={
            <Card.TokenValue
              tokenImageUri={perpsCumulativeRewards.token?.logoURI}
              amount={perpsCumulativeRewards.undistributedReward}
              symbol={perpsCumulativeRewards.token?.symbol}
            />
          }
        />
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}

export { usePerpsCumulativeRewards } from './hooks/usePerpsCumulativeRewards';
