import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

import { QuickDepositContent } from './QuickDepositContent';

const QuickDepositPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.QuickDeposit
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  const resolvedParams = useMemo(() => {
    const { networkId, symbol, provider, vault, tokenImageUri, protocols } =
      route.params;
    return {
      accountId: selectedAccount.othersWalletAccountId || '',
      indexedAccountId:
        selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id,
      networkId,
      symbol: symbol as ISupportedSymbol,
      provider,
      vault,
      tokenImageUri,
      protocols,
    };
  }, [route.params, activeAccount, selectedAccount]);

  return (
    <Page scrollEnabled>
      <Page.Header title={resolvedParams.symbol} />
      <Page.Body>
        <QuickDepositContent
          networkId={resolvedParams.networkId}
          symbol={resolvedParams.symbol}
          provider={resolvedParams.provider}
          vault={resolvedParams.vault}
          accountId={resolvedParams.accountId}
          indexedAccountId={resolvedParams.indexedAccountId}
          tokenImageUri={resolvedParams.tokenImageUri}
          protocols={resolvedParams.protocols}
        />
      </Page.Body>
    </Page>
  );
};

function QuickDepositPageWithProvider() {
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
          <QuickDepositPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default QuickDepositPageWithProvider;
