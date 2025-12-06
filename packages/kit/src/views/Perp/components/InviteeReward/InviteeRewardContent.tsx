import { useIntl } from 'react-intl';

import type { useInTabDialog } from '@onekeyhq/components';
import {
  Alert,
  Divider,
  ScrollView,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { perpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { RewardHistoryList } from './components/RewardHistoryList';
import { RewardSummaryCard } from './components/RewardSummaryCard';

interface IInviteeRewardContentProps {
  walletAddress: string;
  isMobile?: boolean;
}

export function InviteeRewardContent({
  walletAddress,
  isMobile,
}: IInviteeRewardContentProps) {
  const intl = useIntl();
  const { result: data, isLoading } = usePromiseResult(
    async () => {
      if (!walletAddress) {
        return undefined;
      }

      return backgroundApiProxy.serviceReferralCode.getPerpsInviteeRewards({
        walletAddress,
      });
    },
    [walletAddress],
    { watchLoading: true },
  );

  const content = (
    <YStack gap="$5">
      <YStack gap="$5">
        <RewardSummaryCard
          isLoading={isLoading}
          totalBonus={data?.totalBonus}
          undistributed={data?.undistributed}
          tokenSymbol={data?.token.symbol}
        />
      </YStack>
      <Divider />
      <YStack gap="$2">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.referral_reward_history,
          })}
        </SizableText>
        <RewardHistoryList
          isLoading={isLoading}
          history={data?.history}
          token={data?.token}
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

export async function showInviteeRewardDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const selectedAccount = await perpsActiveAccountAtom.get();

  const walletAddress = selectedAccount.accountAddress;

  if (!walletAddress) {
    console.error('[InviteeRewardModal] Missing required parameters');
    Toast.error({
      title: 'Please select a valid account first',
    });
    return;
  }

  const dialogInTabRef = dialogInTab.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perps_trade_reward,
    }),
    floatingPanelProps: {
      width: 480,
    },
    renderContent: (
      <PerpsProviderMirror>
        <InviteeRewardContent walletAddress={walletAddress} />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInTabRef.close();
    },
  });

  return dialogInTabRef;
}
