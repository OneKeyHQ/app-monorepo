import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';

const BorrowManagePosition = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const resolvedParams = useMemo(() => {
    const {
      networkId,
      symbol,
      provider,
      logoURI,
      reserveAddress,
      marketAddress,
    } = route.params;
    return {
      accountId: activeAccount.account?.id || '',
      indexedAccountId: activeAccount.indexedAccount?.id,
      networkId,
      symbol,
      provider,
      logoURI,
      reserveAddress,
      marketAddress,
    };
  }, [route.params, activeAccount]);

  const {
    accountId,
    indexedAccountId,
    networkId,
    symbol,
    provider,
    logoURI,
    reserveAddress,
    marketAddress,
  } = resolvedParams;

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol || 'Manage Position'} />
      <Page.Body>
        <ManagePositionContent
          showApyDetail
          isInModalContext
          networkId={networkId}
          symbol={symbol}
          provider={provider}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          fallbackTokenImageUri={logoURI}
          type={EManagePositionType.Borrow}
          reserveAddress={reserveAddress}
          marketAddress={marketAddress}
        />
      </Page.Body>
    </Page>
  );
};

function BorrowManagePositionWithProvider() {
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
          <BorrowManagePosition />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default BorrowManagePositionWithProvider;
