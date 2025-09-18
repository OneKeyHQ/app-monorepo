import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import debugUtils from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import TokenDetailsHeader from './TokenDetailsHeader';
import TokenDetailsHistory from './TokenDetailsHistory';

import type { IProps } from '.';

const num = 0;

function TokenDetailsViews(props: IProps) {
  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    deriveInfo: deriveInfoProp,
    deriveType: deriveTypeProp,
    isAllNetworks,
    refreshAllNetworkState,
    allNetworksState,
  } = props;

  const [deriveInfo, setDeriveInfo] = useState(deriveInfoProp);
  const [deriveType, setDeriveType] = useState(deriveTypeProp);

  const depsChecker =
    debugUtils.useDebugHooksDepsChangedChecker('TokenDetailsViews');
  useEffect(() => {
    depsChecker.checkDeps(props);
  }, [props, depsChecker]);

  const intl = useIntl();

  useEffect(() => {
    const fetchDefaultDerive = async () => {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const defaultDeriveInfo =
        await backgroundApiProxy.serviceNetwork.getDeriveInfoOfNetwork({
          networkId,
          deriveType: defaultDeriveType,
        });
      setDeriveType(defaultDeriveType);
      setDeriveInfo(defaultDeriveInfo);
    };
    if (deriveInfo && deriveType) {
      setDeriveInfo(deriveInfo);
      setDeriveType(deriveType);
    } else {
      void fetchDefaultDerive();
    }
  }, [deriveInfo, deriveType, networkId]);

  const [currentAccountId, setCurrentAccountId] = useState(accountId);

  const handleCreateAccount = useCallback(
    async (params: { accounts: IDBAccount[] } | undefined) => {
      if (params && params.accounts && params.accounts.length > 0) {
        setCurrentAccountId(params.accounts[0].id);

        if (
          isAllNetworks &&
          allNetworksState &&
          !isEnabledNetworksInAllNetworks({
            networkId,
            disabledNetworks: allNetworksState.disabledNetworks,
            enabledNetworks: allNetworksState.enabledNetworks,
            isTestnet: false,
          })
        ) {
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [networkId]: true },
          });
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
          refreshAllNetworkState?.();
        }
      }
    },
    [allNetworksState, isAllNetworks, networkId, refreshAllNetworkState, intl],
  );

  if (!currentAccountId) {
    return (
      <Empty
        mt={160}
        testID="TokenDetailsViews__Wallet-No-Address-Empty"
        description={intl.formatMessage({
          id: ETranslations.wallet_no_address_desc,
        })}
        button={
          <AccountSelectorCreateAddressButton
            num={num}
            selectAfterCreate
            account={{
              walletId,
              networkId,
              indexedAccountId,
              deriveType,
            }}
            buttonRender={Empty.Button}
            onCreateDone={handleCreateAccount}
          />
        }
      />
    );
  }
  return (
    <TokenDetailsHistory
      {...props}
      deriveInfo={deriveInfo}
      deriveType={deriveType}
      accountId={currentAccountId}
      ListHeaderComponent={
        <TokenDetailsHeader pt="$5" {...props} accountId={currentAccountId} />
      }
    />
  );
}

export default memo(TokenDetailsViews);
