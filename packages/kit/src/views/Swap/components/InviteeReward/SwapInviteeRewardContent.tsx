import { useIntl } from 'react-intl';

import { Button, Empty, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { InviteeRewardNoWallet } from '@onekeyhq/kit/src/views/ReferFriends/components/InviteeRewardNoWallet';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RewardSummaryCard } from './components/RewardSummaryCard';
import { loadSwapInviteeReward } from './utils';

interface ISwapInviteeRewardContentProps {
  accountId?: string;
  currentEvmAddress?: string;
  isMobile?: boolean;
}

function UnsupportedWalletState() {
  const intl = useIntl();

  return (
    <YStack flex={1} jc="center" ai="center" py="$10">
      <Empty
        icon="WalletOutline"
        title={intl.formatMessage({
          id: ETranslations.perps_account_not_support,
        })}
      />
    </YStack>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();

  return (
    <YStack minHeight={260} jc="center" ai="center" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_failed })}
      </SizableText>
      <Button
        testID="swap-invitee-reward-retry"
        size="small"
        variant="secondary"
        onPress={onRetry}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
}

export function SwapInviteeRewardContent({
  accountId,
  currentEvmAddress,
  isMobile,
}: ISwapInviteeRewardContentProps) {
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!accountId) {
        return undefined;
      }

      return loadSwapInviteeReward({
        accountId,
        currentEvmAddress,
        dependencies: {
          ethNetworkId: getNetworkIdsMap().eth,
          getReferralCodeWalletInfo: (params) =>
            backgroundApiProxy.serviceReferralCode.getReferralCodeWalletInfo(
              params,
            ),
          getSwapInviteeRewards: (params) =>
            backgroundApiProxy.serviceReferralCode.getSwapInviteeRewards(
              params,
            ),
        },
      });
    },
    [accountId, currentEvmAddress],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );

  if (!accountId) {
    return <InviteeRewardNoWallet testID="swap-invitee-reward-onboarding" />;
  }

  if (result?.status === 'unsupported') {
    return <UnsupportedWalletState />;
  }

  if (result?.status === 'error') {
    return (
      <ErrorState
        onRetry={() => {
          void run();
        }}
      />
    );
  }

  const data = result?.status === 'success' ? result.data : undefined;
  const showLoading = Boolean(isLoading || !result);
  const content = (
    <YStack gap="$5">
      <RewardSummaryCard
        isLoading={showLoading}
        totalBonus={data?.totalBonus}
        undistributed={data?.undistributed}
        tokenSymbol={data?.token.symbol}
      />
    </YStack>
  );

  if (isMobile) {
    return (
      <YStack flex={1} gap="$5" px="$5" py="$3">
        {content}
      </YStack>
    );
  }

  return content;
}
