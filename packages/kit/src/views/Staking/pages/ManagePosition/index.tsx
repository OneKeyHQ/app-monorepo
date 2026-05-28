import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

import {
  type IManagePositionProtocolSwitchConfig,
  ManagePositionContent,
} from './components/ManagePositionContent';

type ISelectedProtocol = {
  networkId: string;
  provider: string;
  vault?: string;
};

function getProtocolKey(protocol: ISelectedProtocol) {
  return `${protocol.provider.toLowerCase()}-${protocol.networkId}-${protocol.vault ?? ''}`;
}

function createSelectedProtocolFromItem(
  item: IStakeProtocolListItem,
): ISelectedProtocol {
  return {
    networkId: item.network.networkId,
    provider: item.provider.name,
    vault: earnUtils.shouldSendEarnProtocolVault({
      providerName: item.provider.name,
    })
      ? item.provider.vault
      : undefined,
  };
}

function getProtocolItemKey(item: IStakeProtocolListItem) {
  return getProtocolKey(createSelectedProtocolFromItem(item));
}

const ManagePositionPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
    symbol: ISupportedSymbol;
    tokenImageUri: string | undefined;
    enableProtocolSwitch: boolean;
    initialProtocol: ISelectedProtocol;
    initialTab: 'deposit' | 'withdraw';
  }>(() => {
    const {
      networkId,
      symbol,
      provider,
      vault,
      tokenImageUri,
      enableProtocolSwitch,
      tab,
    } = route.params;

    return {
      accountId: selectedAccount.othersWalletAccountId || '',
      indexedAccountId:
        selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id,
      symbol: symbol as ISupportedSymbol,
      tokenImageUri,
      enableProtocolSwitch: !!enableProtocolSwitch,
      initialProtocol: {
        networkId,
        provider,
        vault,
      },
      initialTab: tab ?? 'deposit',
    };
  }, [activeAccount, route.params, selectedAccount]);

  const initialProtocolKey = useMemo(
    () => getProtocolKey(resolvedParams.initialProtocol),
    [resolvedParams.initialProtocol],
  );
  const initialProtocolKeyRef = useRef(initialProtocolKey);
  const [selectedProtocol, setSelectedProtocol] = useState<ISelectedProtocol>(
    resolvedParams.initialProtocol,
  );
  const [selectedTab, setSelectedTab] = useState<'deposit' | 'withdraw'>(
    resolvedParams.initialTab,
  );

  useEffect(() => {
    if (initialProtocolKeyRef.current !== initialProtocolKey) {
      initialProtocolKeyRef.current = initialProtocolKey;
      setSelectedProtocol(resolvedParams.initialProtocol);
    }
  }, [initialProtocolKey, resolvedParams.initialProtocol]);

  useEffect(() => {
    setSelectedTab(resolvedParams.initialTab);
  }, [initialProtocolKey, resolvedParams.initialTab]);

  const {
    accountId,
    indexedAccountId,
    symbol,
    tokenImageUri,
    enableProtocolSwitch,
  } = resolvedParams;

  const { result: protocols, isLoading: isProtocolListLoading } =
    usePromiseResult(
      async () => {
        // Protocol switching is symbol-based and can still work for HD/HW
        // accounts where only indexedAccountId is available.
        if (!enableProtocolSwitch) {
          return [];
        }

        return backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          indexedAccountId,
        });
      },
      [accountId, enableProtocolSwitch, indexedAccountId, symbol],
      {
        initResult: [],
        watchLoading: true,
      },
    );

  const selectedProtocolKey = useMemo(
    () => getProtocolKey(selectedProtocol),
    [selectedProtocol],
  );
  const currentProtocol = useMemo(
    () =>
      protocols.find(
        (item) => getProtocolItemKey(item) === getProtocolKey(selectedProtocol),
      ),
    [protocols, selectedProtocol],
  );

  const handleProtocolSelect = useCallback(
    (protocol: IStakeProtocolListItem) => {
      const nextProtocol = createSelectedProtocolFromItem(protocol);

      setSelectedProtocol((currentSelection) => {
        if (getProtocolKey(currentSelection) === getProtocolKey(nextProtocol)) {
          return currentSelection;
        }

        return nextProtocol;
      });
    },
    [],
  );

  const stakeProtocolSwitchConfig = useMemo<
    IManagePositionProtocolSwitchConfig | undefined
  >(() => {
    if (!enableProtocolSwitch) {
      return undefined;
    }

    return {
      currentProtocol,
      indexedAccountId,
      isLoading: isProtocolListLoading,
      protocols,
      selectedProtocol,
      onProtocolSelect: handleProtocolSelect,
    };
  }, [
    currentProtocol,
    enableProtocolSwitch,
    handleProtocolSelect,
    indexedAccountId,
    isProtocolListLoading,
    protocols,
    selectedProtocol,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol} />
      <Page.Body>
        <ManagePositionContent
          key={selectedProtocolKey}
          showApyDetail
          isInModalContext
          networkId={selectedProtocol.networkId}
          symbol={symbol}
          provider={selectedProtocol.provider}
          vault={selectedProtocol.vault}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          fallbackTokenImageUri={tokenImageUri}
          defaultTab={selectedTab}
          onTabChange={setSelectedTab}
          stakeProtocolSwitchConfig={stakeProtocolSwitchConfig}
        />
      </Page.Body>
    </Page>
  );
};

function ManagePositionPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <ManagePositionPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ManagePositionPageWithProvider;
