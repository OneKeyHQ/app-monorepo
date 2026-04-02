import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components';
import {
  RewardHeaderLayout,
  StatCard,
} from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsCumulativeRewardsResponse } from '@onekeyhq/shared/src/referralCode/type';

interface IPerpsRewardHeaderProps {
  data: IPerpsCumulativeRewardsResponse | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function PerpsRewardHeader({
  data,
  isLoading,
  onRefresh,
}: IPerpsRewardHeaderProps) {
  const intl = useIntl();
  const { md } = useMedia();

  const isWideScreen = !md;

  if (!data) {
    return null;
  }

  const undistributed = data.undistributedRewardFiatValue || '0';
  const totalReward = data.totalRewardFiatValue || '0';
  const volume = data.totalVolumeFiatValue || '0';
  const invitedAddresses = data.invitedAddresses || 0;
  const walletCount = data.walletCount || 0;

  return (
    <RewardHeaderLayout
      primaryCard={
        <StatCard
          icon="CoinOutline"
          iconBgColor="$bgSuccess"
          iconColor="$iconSuccess"
          title={intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
          value={undistributed}
          valueColor="$textSuccess"
          subtitle={`${intl.formatMessage({
            id: ETranslations.referral_perps_total,
          })}: $${new BigNumber(totalReward).toFixed(2)}`}
          showRefreshButton
          isLoading={isLoading}
          onRefresh={onRefresh}
          isWide={isWideScreen}
          fullWidth={!isWideScreen}
        />
      }
      secondaryCards={
        <>
          <StatCard
            icon="ChartLineOutline"
            iconBgColor="$bgStrong"
            iconColor="$icon"
            title={intl.formatMessage({
              id: ETranslations.referral_perps_volume,
            })}
            value={volume}
            isWide={isWideScreen}
          />
          <StatCard
            icon="WalletOutline"
            iconBgColor="$bgStrong"
            iconColor="$icon"
            title={intl.formatMessage({
              id: ETranslations.referral_perps_invited_addresses,
            })}
            value={String(invitedAddresses)}
            isCurrency={false}
            subtitle={intl.formatMessage(
              { id: ETranslations.referral_perps_from_wallets },
              { number: walletCount },
            )}
            isWide={isWideScreen}
          />
        </>
      }
    />
  );
}
