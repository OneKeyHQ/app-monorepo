import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Empty,
  ScrollView,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RewardHistoryList } from './components/RewardHistoryList';
import { RewardSummaryCard } from './components/RewardSummaryCard';
import { loadSwapInviteeReward } from './utils';

interface ISwapInviteeRewardContentProps {
  accountId?: string;
  isMobile?: boolean;
}

function NoWalletEmptyState() {
  const intl = useIntl();
  const toOnBoardingPage = useToOnBoardingPage();

  return (
    <YStack flex={1} jc="center" ai="center" py="$10">
      <Empty
        icon="WalletOutline"
        title={intl.formatMessage({
          id: ETranslations.referral_apply_code_no_wallet,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_apply_code_no_wallet_desc,
        })}
      />
      <Button
        testID="swap-invitee-reward-onboarding"
        mt="$5"
        onPress={() => {
          void toOnBoardingPage();
        }}
      >
        {intl.formatMessage({
          id: platformEnv.isWebDappMode
            ? ETranslations.global_connect_wallet
            : ETranslations.global_create_wallet,
        })}
      </Button>
    </YStack>
  );
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
  isMobile,
}: ISwapInviteeRewardContentProps) {
  const intl = useIntl();
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!accountId) {
        return undefined;
      }

      return loadSwapInviteeReward({
        accountId,
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
    [accountId],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );

  if (!accountId) {
    return <NoWalletEmptyState />;
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
      <Divider />
      <YStack gap="$2">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.referral_reward_history,
          })}
        </SizableText>
        <RewardHistoryList
          key={accountId}
          isLoading={showLoading}
          history={data?.history}
        />
      </YStack>
    </YStack>
  );

  if (isMobile) {
    return (
      <YStack flex={1} gap="$5" px="$5" py="$3">
        {content}
      </YStack>
    );
  }

  return (
    <ScrollView minHeight={350} maxHeight={500}>
      {content}
    </ScrollView>
  );
}
