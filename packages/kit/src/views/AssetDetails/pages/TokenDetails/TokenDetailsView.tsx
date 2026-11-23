import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { IMPL_STARKNET } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import debugUtils from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';

import { useTokenDetailsContext } from './TokenDetailsContext';
import TokenDetailsHeader from './TokenDetailsHeader';
import TokenDetailsHistory from './TokenDetailsHistory';
import { TokenDetailsPager } from './TokenDetailsPager';

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
    tokenInfo,
  } = props;

  const [deriveInfo, setDeriveInfo] = useState(deriveInfoProp);
  const [deriveType, setDeriveType] = useState(deriveTypeProp);

  const { setTokenAccountMap } = useTokenDetailsContext();

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
        setTokenAccountMap((prev) => ({
          ...prev,
          [`${networkId}_${tokenInfo.address}`]: params.accounts[0].id,
        }));

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
    [
      allNetworksState,
      isAllNetworks,
      networkId,
      refreshAllNetworkState,
      intl,
      setTokenAccountMap,
      tokenInfo.address,
    ],
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

function TokenDetailsViewsWithPrivacy(props: IProps) {
  const intl = useIntl();
  if (
    networkUtils.getNetworkImpl({ networkId: props.networkId }) !==
    IMPL_STARKNET
  ) {
    return <TokenDetailsViews {...props} />;
  }
  if (
    accountUtils.isWatchingOrExternalAccount({
      accountId: props.accountId || props.walletId,
    })
  ) {
    return <TokenDetailsViews {...props} starknetPrivacyMode="public" />;
  }
  return (
    <TokenDetailsPager
      key={`${props.accountId}_${props.networkId}_${props.tokenInfo.address}`}
      pages={(['public', 'private'] as const).map((mode) => ({
        key: mode,
        name: intl.formatMessage({
          id:
            mode === 'public'
              ? ETranslations.privacy_balance_public__title
              : ETranslations.private_send_private_option,
        }),
        children: (
          <TokenDetailsViews
            {...props}
            inTabList
            isTabView
            starknetPrivacyMode={mode}
          />
        ),
      }))}
    />
  );
}

export default memo(TokenDetailsViewsWithPrivacy);
