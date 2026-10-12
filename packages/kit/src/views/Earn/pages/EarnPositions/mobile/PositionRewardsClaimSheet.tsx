import { useCallback } from 'react';

import {
  Dialog,
  NumberSizeableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  PortfolioPendingTxsProvider,
  WrappedActionButton,
} from '../../../components/PortfolioTabContent';
import { EarnProviderMirror } from '../../../EarnProviderMirror';

import type { IEarnPositionClaim } from './myPortfolio.utils';
import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';

/** One claim a card can run: what the row shows, and the claim its button runs. */
export type IPositionClaimSheetItem = {
  key: string;
  networkId: string;
  symbol: string;
  logoUrl?: string;
  amount: string;
  /** request currency; undefined when the server has not priced it */
  value?: number;
  claim: IEarnPositionClaim;
};

/** One claim of the sheet: token, amount and fiat, and its own Claim (figma 30490-21787). */
function ClaimRow({ item }: { item: IPositionClaimSheetItem }) {
  const currencyInfo = useCurrency();
  const dialog = useDialogInstance();
  // The claim goes on to its own confirm page; the sheet has done its part.
  const closeSheet = useCallback(() => {
    void dialog.close();
  }, [dialog]);
  return (
    <XStack ai="center" gap="$3" py="$2">
      <Token
        size="md"
        tokenImageUri={item.logoUrl}
        showNetworkIcon
        networkId={item.networkId}
      />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol: item.symbol }}
          numberOfLines={1}
        >
          {item.amount}
        </NumberSizeableTextWrapper>
        {item.value === undefined ? null : (
          <NumberSizeableText
            size="$bodySm"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {item.value}
          </NumberSizeableText>
        )}
      </YStack>
      <WrappedActionButton
        asset={item.claim.asset}
        reward={item.claim.reward}
        rewardSymbol={item.claim.rewardSymbol}
        onBeforeAction={closeSheet}
      />
    </XStack>
  );
}

/**
 * The Claimable rewards sheet a card's Claim opens when the holding has
 * several rewards to collect (figma 30490-21787, the sheet Borrow uses for
 * Kamino): one row per reward with a claim, each with its own Claim, Cancel
 * below. Each Claim is the button the wide layout runs on that row, so
 * identity, pending spinner and refresh stay the same; the sheet closes as
 * a claim starts.
 */
export function showPositionClaimSheet({
  items,
  onRefresh,
}: {
  items: IPositionClaimSheetItem[];
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
              {items.map((item) => (
                <ClaimRow key={item.key} item={item} />
              ))}
            </YStack>
          </PortfolioPendingTxsProvider>
        </EarnProviderMirror>
      </AccountSelectorProviderMirror>
    ),
  });
}
