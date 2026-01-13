import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';

const BorrowManagePosition = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowManagePosition
  >();

  const {
    networkId,
    symbol,
    provider,
    logoURI,
    providerLogoURI,
    reserveAddress,
    marketAddress,
    type,
    borrowReserves,
  } = route.params;
  const intl = useIntl();
  const { earnAccount } = useEarnAccount({ networkId });
  const accountId = earnAccount?.account?.id || '';
  const indexedAccountId = earnAccount?.account?.indexedAccountId;
  const defaultTab = useMemo(() => {
    if (type === 'withdraw' || type === 'repay') {
      return 'withdraw';
    }
    return 'deposit';
  }, [type]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          symbol ||
          intl.formatMessage({ id: ETranslations.defi_manage_position })
        }
      />
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
          providerLogoUri={providerLogoURI}
          type={type}
          reserveAddress={reserveAddress}
          marketAddress={marketAddress}
          borrowReserves={borrowReserves}
          defaultTab={defaultTab}
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
