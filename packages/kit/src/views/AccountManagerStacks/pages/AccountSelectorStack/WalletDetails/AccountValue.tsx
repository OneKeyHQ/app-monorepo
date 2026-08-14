import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useActiveAccountValueAtom,
  useCurrencyPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountSelectorDeFiItem } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

function AccountValue(accountValue: {
  walletId: string;
  accountId: string;
  currency: string;
  value: Record<string, string> | string;
  accountDeFiOverview?: IAccountSelectorDeFiItem;
  linkedAccountId?: string;
  linkedNetworkId?: string;
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  isSingleAddress?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<string, INetworkDeriveInfo>;
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

  const [{ currencyMap }] = useCurrencyPersistAtom();

  // Hyperliquid perps net worth arrives in USD basis (BG gates its presence by
  // the selector's network context, mirroring Home). Convert to the row
  // value's currency so every branch sums in one basis before <Currency>
  // converts for display — the same USD-basis summation Home performs.
  const perpsNetWorth = useMemo(() => {
    const perpsNetWorthUsd = accountDeFiOverview?.perpsNetWorthUsd;
    if (!perpsNetWorthUsd || !currency) {
      return '0';
    }
    return convertFiat({
      value: perpsNetWorthUsd,
      sourceCurrency: USD_CURRENCY_ID,
      targetCurrency: currency,
      currencyMap,
    });
  }, [accountDeFiOverview?.perpsNetWorthUsd, currency, currencyMap]);

  const accountValueString = useMemo(() => {
    // Branch 1: "others" account — value is already a scalar string.
    if (typeof value === 'string') {
      const deFi =
        accountDeFiOverview?.overview?.[linkedNetworkId ?? '']?.netWorth ?? '0';
      return calculateAccountTotalValue({
        tokensValue: value,
        deFiNetWorth: new BigNumber(deFi).plus(perpsNetWorth).toFixed(),
      });
    }

    // Branch 2: merge-derive chain — BTC/LTC/etc. Intentionally no DeFi
    // (these chains have no DeFi positions; matches prior behavior), and BG
    // supplies no perps for their non-DeFi contexts either.
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
      const deFiRaw =
        accountDeFiOverview?.overview?.[linkedNetworkId]?.netWorth;
      const hasPerps = accountDeFiOverview?.perpsNetWorthUsd !== undefined;
      return calculateAccountTotalValue({
        tokensValue: value,
        // Preserve the undefined "no data → --" sentinel: only materialize
        // a number when DeFi or perps actually contributed.
        deFiNetWorth:
          deFiRaw === undefined && !hasPerps
            ? undefined
            : new BigNumber(deFiRaw ?? '0').plus(perpsNetWorth).toFixed(),
        accountId: linkedAccountId,
        networkId: linkedNetworkId,
      });
    }

    // Branch 4: All Networks / wallet-scoped derive matching
    const deFiAll = Object.values(accountDeFiOverview?.overview ?? {}).reduce(
      (acc, curr) =>
        new BigNumber(acc ?? '0').plus(curr?.netWorth ?? '0').toFixed(),
      perpsNetWorth,
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
    perpsNetWorth,
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
  networkInfoMap: Record<string, INetworkDeriveInfo>;
  accountDeFiOverview?: IAccountSelectorDeFiItem;
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
