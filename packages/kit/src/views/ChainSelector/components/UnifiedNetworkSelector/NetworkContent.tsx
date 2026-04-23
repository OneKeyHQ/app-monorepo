import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableChainSelectorContent } from '../EditableChainSelector/ChainSelectorContent';

const defaultChainSelectorNetworks: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
} = {
  mainnetItems: [],
  testnetItems: [],
  unavailableItems: [],
  frequentlyUsedItems: [],
};

type INetworkContentProps = {
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  networkIds?: string[];
  onPressItem?: (network: IServerNetwork) => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  searchText?: string;
  setSearchText?: Dispatch<SetStateAction<string>>;
  accountAddress?: string;
};

export function NetworkContent({
  walletId,
  accountId,
  indexedAccountId,
  networkId,
  networkIds,
  onPressItem,
  onEditCustomNetwork,
  searchText,
  setSearchText,
}: INetworkContentProps) {
  // Stable hash of networkIds so the swrKey doesn't churn when the caller
  // passes a fresh array reference with unchanged contents.
  const networkIdsKey = useMemo(() => {
    if (!networkIds) return undefined;
    return networkIds.toSorted().join(',');
  }, [networkIds]);

  const swrKey = useMemo(
    () =>
      swrKeys.networkContentData({
        walletId,
        accountId,
        indexedAccountId,
        networkIdsKey,
      }),
    [walletId, accountId, indexedAccountId, networkIdsKey],
  );

  // Cold-start diagnostic: log every swrKey transition + whether the
  // MMKV-backed SWR cache has an entry for the current key. Expect to
  // see (a) an initial key with empty walletId/accountId if the jotai
  // context hasn't resolved yet (hit=false), followed by (b) the real
  // key (hit=? depends on whether it was primed). dtMs includes the
  // one-time JSON.parse of the whole store on cold start.
  useEffect(() => {
    const t = Date.now();
    const cached = swrCacheUtils.get(swrKey);
    console.log(
      `[NetSWR] netContent.swrKey -> ${swrKey} hit=${!!cached} dtMs=${
        Date.now() - t
      }`,
    );
  }, [swrKey]);

  const {
    result: {
      chainSelectorNetworks,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
      zeroValue,
    },
    run: refreshLocalData,
  } = usePromiseResult(
    async () => {
      const [_accountsValue, _chainSelectorNetworks, _localDeFiOverview] =
        await Promise.all([
          backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValue({
            accounts: [{ accountId: indexedAccountId ?? accountId ?? '' }],
          }),
          backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            {
              accountId,
              walletId,
              networkIds,
              useDefaultPinnedNetworks: true,
            },
          ),
          backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: indexedAccountId ?? accountId ?? '',
                networkId: getNetworkIdsMap().onekeyall,
                indexedAccountId,
              },
            ],
            networksEnabledOnly: false,
          }),
        ]);

      if (_accountsValue[0] || _localDeFiOverview[0]) {
        const {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          formattedAccountNetworkValues,
          accountDeFiOverview: _accountDeFiOverview,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          zeroValue,
        } = await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: _accountsValue[0]?.accountId ?? '',
            }),
            chainSelectorNetworks: _chainSelectorNetworks,
            accountNetworkValues: _accountsValue[0]?.value ?? {},
            localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
          },
        );

        return {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          accountNetworkValues: formattedAccountNetworkValues,
          accountNetworkValueCurrency: _accountsValue[0]?.currency,
          accountDeFiOverview: _accountDeFiOverview,
          zeroValue,
        };
      }

      return {
        chainSelectorNetworks: _chainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
        zeroValue: true,
      };
    },
    [accountId, networkIds, walletId, indexedAccountId],
    {
      initResult: {
        chainSelectorNetworks: defaultChainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
        zeroValue: true,
      },
      swrKey,
    },
  );

  useEffect(() => {
    const fn = async () => {
      try {
        // Use alwaysSetState to bypass the isFocused check, because this
        // event can fire while the navigation-back animation is still
        // running (screen not yet focused), which would silently skip
        // the refresh and leave stale data in the search list.
        await refreshLocalData({ alwaysSetState: true });
      } catch {
        // silently ignore refresh errors
      }
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshLocalData]);

  return (
    <EditableChainSelectorContent
      recentNetworksEnabled
      showAllNetworkInRecentNetworks
      walletId={walletId}
      networkId={networkId}
      accountId={accountId}
      indexedAccountId={indexedAccountId}
      zeroValue={zeroValue}
      mainnetItems={chainSelectorNetworks.mainnetItems}
      testnetItems={chainSelectorNetworks.testnetItems}
      unavailableItems={chainSelectorNetworks.unavailableItems}
      frequentlyUsedItems={chainSelectorNetworks.frequentlyUsedItems}
      accountDeFiOverview={accountDeFiOverview}
      accountNetworkValues={accountNetworkValues}
      accountNetworkValueCurrency={accountNetworkValueCurrency}
      onPressItem={onPressItem}
      onEditCustomNetwork={onEditCustomNetwork}
      searchText={searchText}
      setSearchText={setSearchText}
    />
  );
}
