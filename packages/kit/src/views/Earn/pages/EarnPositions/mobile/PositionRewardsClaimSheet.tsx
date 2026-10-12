import { useCallback, useMemo } from 'react';

import {
  Dialog,
  NumberSizeableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  PortfolioPendingTxsProvider,
  WrappedActionButton,
} from '../../../components/PortfolioTabContent';
import { EarnProviderMirror } from '../../../EarnProviderMirror';

import { toPositionRewardClaim } from './myPortfolio.utils';

import type { IEarnClaimableReward } from './earnPositionModel';
import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';

/** One reward of the sheet: token, amount and fiat, and its own Claim (figma 30490-21787). */
function ClaimRow({
  position,
  reward,
}: {
  position: IEarnPortfolioPosition;
  reward: IEarnClaimableReward;
}) {
  const currencyInfo = useCurrency();
  const dialog = useDialogInstance();
  const claim = useMemo(
    () => toPositionRewardClaim(position, reward),
    [position, reward],
  );
  // The claim goes on to its own confirm page; the sheet has done its part.
  const closeSheet = useCallback(() => {
    void dialog.close();
  }, [dialog]);
  return (
    <XStack ai="center" gap="$3" py="$2">
      <Token
        size="md"
        tokenImageUri={reward.meta?.logoUrl}
        showNetworkIcon
        networkId={position.networkId}
      />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol: reward.symbol }}
          numberOfLines={1}
        >
          {reward.amount}
        </NumberSizeableTextWrapper>
        {isProtocolAssetValueUnavailable(reward) ? null : (
          <NumberSizeableText
            size="$bodySm"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {reward.value}
          </NumberSizeableText>
        )}
      </YStack>
      <WrappedActionButton
        asset={claim.asset}
        reward={claim.reward}
        rewardSymbol={claim.rewardSymbol}
        onBeforeAction={closeSheet}
      />
    </XStack>
  );
}

/**
 * The Claimable rewards sheet a card's Claim opens when its rewards are
 * claimed one by one (figma 30490-21787, the sheet Borrow uses for Kamino):
 * one row per reward with its own Claim, Cancel below. Each Claim is the
 * button the wide layout runs on that row, so identity, pending spinner and
 * refresh stay the same; the sheet closes as a claim starts.
 */
export function showPositionRewardsClaimSheet({
  position,
  rewards,
  onRefresh,
}: {
  position: IEarnPortfolioPosition;
  rewards: IEarnClaimableReward[];
  onRefresh?: (options?: IRefreshOptions) => Promise<void>;
}) {
  return Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.defi_claimable_rewards,
    }),
    showFooter: true,
    showConfirmButton: false,
    renderContent: (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
      >
        <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
          <PortfolioPendingTxsProvider value={{ onRefresh }}>
            <YStack>
              {rewards.map((reward, index) => (
                <ClaimRow
                  key={`${reward.symbol}-${index}`}
                  position={position}
                  reward={reward}
                />
              ))}
            </YStack>
          </PortfolioPendingTxsProvider>
        </EarnProviderMirror>
      </AccountSelectorProviderMirror>
    ),
  });
}
