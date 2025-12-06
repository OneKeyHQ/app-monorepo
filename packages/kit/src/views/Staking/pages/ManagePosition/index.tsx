import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

import { ManagePositionContent } from './components/ManagePositionContent';

const ManagePositionPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // parse route params, support two types of routes
  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
    networkId: string;
    symbol: ISupportedSymbol;
    provider: string;
    vault: string | undefined;
    tokenImageUri: string | undefined;
    protocolInputDecimals: number | undefined;
  }>(() => {
    const {
      networkId,
      symbol,
      provider,
      vault,
      tokenImageUri,
      protocolInputDecimals,
    } = route.params;
    return {
      accountId: activeAccount.account?.id || '',
      indexedAccountId: activeAccount.indexedAccount?.id,
      networkId,
      symbol: symbol as ISupportedSymbol,
      provider,
      vault,
      tokenImageUri,
      protocolInputDecimals,
    };
  }, [route.params, activeAccount]);

  const {
    accountId,
    indexedAccountId,
    networkId,
    symbol,
    provider,
    vault,
    tokenImageUri,
    protocolInputDecimals,
  } = resolvedParams;

  // Get tab from route params
  const defaultTab = route.params?.tab;

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol} />
      <Page.Body>
        <ManagePositionContent
          showApyDetail
          isInModalContext
          networkId={networkId}
          symbol={symbol}
          provider={provider}
          vault={vault}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          fallbackTokenImageUri={tokenImageUri}
          protocolInputDecimals={protocolInputDecimals}
          defaultTab={defaultTab}
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
