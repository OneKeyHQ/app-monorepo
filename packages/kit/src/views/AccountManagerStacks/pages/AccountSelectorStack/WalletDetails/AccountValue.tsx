import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

function AccountValue(accountValue: {
  walletId: string;
  accountId: string;
  currency: string;
  value: Record<string, string> | string;
  accountDeFiOverview?: {
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
  };
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<
    string,
    {
      deriveType: IAccountDeriveTypes;
      mergeDeriveAssetsEnabled: boolean;
    }
  >;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const isActiveAccount =
    activeAccountValue?.accountId === accountValue?.accountId;

  const {
    linkedAccountId,
    linkedNetworkId,
    walletId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    accountDeFiOverview,
  } = accountValue;

  const { currency, value } = useMemo(() => {
    if (activeAccountValue && isActiveAccount) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue, isActiveAccount]);

  const accountValueString = useMemo(() => {
    // Branch 1: "others" account — value is already a scalar string.
    if (typeof value === 'string') {
      const deFi =
        accountDeFiOverview?.overview?.[linkedNetworkId ?? '']?.netWorth ?? '0';
      return calculateAccountTotalValue({
        tokensValue: value,
        deFiNetWorth: deFi,
      });
    }

    // Branch 2: merge-derive chain — BTC/LTC/etc. Intentionally no DeFi
    // (these chains have no DeFi positions; matches prior behavior).
    if (linkedNetworkId && mergeDeriveAssetsEnabled && !isSingleAddress) {
      return calculateAccountTotalValue({
        tokensValue: value,
        deFiNetWorth: 0,
        mergeDeriveAssetsEnabled: true,
        networkId: linkedNetworkId,
      });
    }

    // Branch 3: single network, specific account
    if (
      linkedAccountId &&
      linkedNetworkId &&
      !networkUtils.isAllNetwork({ networkId: linkedNetworkId })
    ) {
      return calculateAccountTotalValue({
        tokensValue: value,
        deFiNetWorth:
          accountDeFiOverview?.overview?.[linkedNetworkId]?.netWorth,
        accountId: linkedAccountId,
        networkId: linkedNetworkId,
      });
    }

    // Branch 4: All Networks / wallet-scoped derive matching
    const deFiAll = Object.values(accountDeFiOverview?.overview ?? {}).reduce(
      (acc, curr) =>
        new BigNumber(acc ?? '0').plus(curr?.netWorth ?? '0').toFixed(),
      '0',
    );
    return calculateAccountTotalValue({
      tokensValue: value,
      deFiNetWorth: deFiAll,
      walletId,
      enabledNetworksCompatibleWithWalletId,
      networkInfoMap,
    });
  }, [
    value,
    linkedNetworkId,
    mergeDeriveAssetsEnabled,
    isSingleAddress,
    linkedAccountId,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    accountDeFiOverview,
    walletId,
  ]);

  return accountValueString ? (
    <Currency
      hideValue
      numberOfLines={1}
      flexShrink={1}
      size="$bodyMd"
      color="$textSubdued"
      sourceCurrency={currency}
    >
      {accountValueString}
    </Currency>
  ) : (
    <NumberSizeableTextWrapper
      formatter="value"
      hideValue
      size="$bodyMd"
      color="$textDisabled"
    >
      --
    </NumberSizeableTextWrapper>
  );
}

function AccountValueWithSpotlight({
  walletId,
  accountValue,
  linkedAccountId,
  linkedNetworkId,
  indexedAccountId,
  mergeDeriveAssetsEnabled,
  isSingleAddress,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
  accountDeFiOverview,
}: {
  accountValue:
    | {
        accountId: string;
        currency: string | undefined;
        value: Record<string, string> | string | undefined;
      }
    | undefined;
  isOthersUniversal: boolean;
  index: number;
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
  walletId: string;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<
    string,
    {
      deriveType: IAccountDeriveTypes;
      mergeDeriveAssetsEnabled: boolean;
    }
  >;
  accountDeFiOverview?: {
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
  };
}) {
  return accountValue && accountValue.currency ? (
    <AccountValue
      walletId={walletId}
      accountId={accountValue.accountId}
      currency={accountValue.currency}
      value={accountValue.value ?? ''}
      linkedAccountId={linkedAccountId}
      linkedNetworkId={linkedNetworkId}
      indexedAccountId={indexedAccountId}
      mergeDeriveAssetsEnabled={mergeDeriveAssetsEnabled}
      isSingleAddress={isSingleAddress}
      enabledNetworksCompatibleWithWalletId={
        enabledNetworksCompatibleWithWalletId
      }
      networkInfoMap={networkInfoMap}
      accountDeFiOverview={accountDeFiOverview}
    />
  ) : (
    <NumberSizeableTextWrapper
      formatter="value"
      hideValue
      size="$bodyMd"
      color="$textDisabled"
    >
      --
    </NumberSizeableTextWrapper>
  );
}

export { AccountValue, AccountValueWithSpotlight };
