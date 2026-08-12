import type { useInTabDialog } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { InviteeRewardNoWallet } from '@onekeyhq/kit/src/views/ReferFriends/components/InviteeRewardNoWallet';
import { perpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { RewardSummaryCard } from './components/RewardSummaryCard';

interface IInviteeRewardContentProps {
  walletAddress: string;
  isMobile?: boolean;
}

export function InviteeRewardContent({
  walletAddress,
  isMobile,
}: IInviteeRewardContentProps) {
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

  if (!walletAddress) {
    return <InviteeRewardNoWallet testID="perp-to-on-boarding-page-btn" />;
  }

  const content = (
    <YStack gap="$5">
      <RewardSummaryCard
        isLoading={isLoading}
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

export async function showInviteeRewardDialog(
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const selectedAccount = await perpsActiveAccountAtom.get();

  const walletAddress = selectedAccount?.accountAddress ?? '';

  const dialogInTabRef = dialogInTab.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
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
