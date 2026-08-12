import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountDeFiOverviewAtom,
  useAccountWorthAtom,
  useOverviewDeFiDataStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { buildOverviewOwnerKey } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview/atoms';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  calculateAccountTokensValue,
  calculateAccountTotalValue,
} from '@onekeyhq/shared/src/utils/tokenUtils';

import { useHomeWalletTabSupport } from './useHomeWalletTabSupport';

export function useHomeOverviewResolvedBalance() {
  const {
    activeAccount: { account, network, vaultSettings },
  } = useActiveAccount({ num: 0 });
  const [accountWorth] = useAccountWorthAtom();
  const [accountDeFiOverview] = useAccountDeFiOverviewAtom();
  const [overviewDeFiDataState] = useOverviewDeFiDataStateAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const { isPerpsSupported: isPerpsEnabled } = useHomeWalletTabSupport({
    network,
  });

  const { result: perpsNetWorthUsd } = usePromiseResult<string | undefined>(
    async () => {
      if (!isPerpsEnabled) return undefined;
      const accountId = account?.id;
      const indexedAccountId = account?.indexedAccountId;
      if (!accountId && !indexedAccountId) return undefined;

      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: PERPS_NETWORK_ID,
        });
      if (!deriveType) return undefined;

      let address = '';
      try {
        const perpsAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : accountId,
            indexedAccountId,
            deriveType,
            networkId: PERPS_NETWORK_ID,
          });
        address =
          perpsAccount?.addressDetail?.normalizedAddress ||
          perpsAccount?.address ||
          '';
      } catch {
        return undefined;
      }

      if (!address) return undefined;
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address },
        );
      return snapshot?.netWorthUsd;
    },
    [account?.id, account?.indexedAccountId, isPerpsEnabled],
    {
      swrKey:
        account?.id || account?.indexedAccountId
          ? `home-overview-perps-worth:${
              account?.indexedAccountId ?? account?.id
            }`
          : undefined,
      pollingInterval: PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
    },
  );

  const ownerKey = useMemo(
    () => buildOverviewOwnerKey(account?.id, network?.id),
    [account?.id, network?.id],
  );
  const currentWorthKey = useMemo(() => {
    if (!account?.id || !network?.id || network.isAllNetworks) {
      return undefined;
    }
    return accountUtils.buildAccountValueKey({
      accountId: account.id,
      networkId: network.id,
    });
  }, [account?.id, network?.id, network?.isAllNetworks]);

  const isWorthReady = useMemo(() => {
    if (!account?.id || !network?.id) return false;
    if (
      !accountWorth.accountId ||
      (accountWorth.accountId !== account.id &&
        accountWorth.accountId !== (account.indexedAccountId ?? ''))
    ) {
      return false;
    }
    if (network.isAllNetworks || vaultSettings?.mergeDeriveAssetsEnabled) {
      return (
        Object.keys(accountWorth.worth).length > 0 ||
        (accountWorth.initialized && !!accountWorth.updateAll)
      );
    }
    return Boolean(
      currentWorthKey &&
      Object.prototype.hasOwnProperty.call(accountWorth.worth, currentWorthKey),
    );
  }, [
    account?.id,
    account?.indexedAccountId,
    accountWorth.accountId,
    accountWorth.initialized,
    accountWorth.updateAll,
    accountWorth.worth,
    currentWorthKey,
    network?.id,
    network?.isAllNetworks,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const isDeFiReady = Boolean(
    account?.id &&
    network?.id &&
    overviewDeFiDataState.ownerKey === ownerKey &&
    overviewDeFiDataState.isReady !== undefined,
  );
  const isFullyReady = !network?.isAllNetworks || (isWorthReady && isDeFiReady);

  const resolvedBalanceUsd = useMemo(() => {
    const isAllNetworks = !!network?.isAllNetworks;
    if (isAllNetworks) {
      if (!isWorthReady && !isDeFiReady) return undefined;
    } else if (!isWorthReady || !isDeFiReady) {
      return undefined;
    }

    const tokenWorth =
      !isAllNetworks || isWorthReady
        ? calculateAccountTokensValue({
            accountId: account?.id ?? '',
            networkId: network?.id ?? '',
            tokensWorth: accountWorth,
            mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
          })
        : '0';
    const tokenWorthUsd = convertFiat({
      value: tokenWorth,
      sourceCurrency: accountWorth.currency ?? settings.currencyInfo.id,
      targetCurrency: USD_CURRENCY_ID,
      currencyMap,
    });
    const deFiWorthUsd = convertFiat({
      value:
        !isAllNetworks || isDeFiReady ? (accountDeFiOverview.netWorth ?? 0) : 0,
      sourceCurrency: accountDeFiOverview.currency || settings.currencyInfo.id,
      targetCurrency: USD_CURRENCY_ID,
      currencyMap,
    });
    const perpsWorthUsd = isPerpsEnabled ? (perpsNetWorthUsd ?? '0') : '0';

    return calculateAccountTotalValue({
      tokensValue: tokenWorthUsd,
      deFiNetWorth: new BigNumber(deFiWorthUsd).plus(perpsWorthUsd).toFixed(),
    });
  }, [
    account?.id,
    accountDeFiOverview.currency,
    accountDeFiOverview.netWorth,
    accountWorth,
    currencyMap,
    isDeFiReady,
    isPerpsEnabled,
    isWorthReady,
    network?.id,
    network?.isAllNetworks,
    perpsNetWorthUsd,
    settings.currencyInfo.id,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  return {
    isDeFiReady,
    isFullyReady,
    isWorthReady,
    ownerKey,
    resolvedBalanceUsd,
  };
}
