import { useCallback, useEffect, useMemo, useState } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import type {
  EModalBulkSendRoutes,
  IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import AssetSelectorTrigger from '../components/AssetSelectorTrigger';
import BulkSendBar from '../components/BulkSendBar';
import BulkSendContentWrapper from '../components/BulkSendContentWrapper';
import {
  BulkSendContext,
  useBulkSendContext,
} from '../components/BulkSendContext';
import BulkSendHeader from '../components/BulkSendHeader';
import { BulkSendProviderMirror } from '../components/HomeApprovalListProvider/BulkSendProviderMirror';

function BaseBulkSendAddressesInput() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAddressesInput
  >();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const { accountId, networkId, tokenInfo } = route.params ?? {};

  const { setSelectedAccountId, setSelectedNetworkId, setSelectedToken } =
    useBulkSendContext();

  const initBulkSendInfo = useCallback(async () => {
    let _selectedAccountId: string | undefined;
    let _selectedNetworkId: string | undefined;
    let _selectedTokenInfo: IToken | undefined;

    if (accountId) {
      _selectedAccountId = accountId;
    } else if (activeAccount?.account?.id) {
      _selectedAccountId = activeAccount?.account?.id;
    }
    if (networkId) {
      _selectedNetworkId = networkId;
    } else {
      _selectedNetworkId = activeAccount?.network?.id;
    }

    _selectedNetworkId = bulkSendUtils.fixBulkSendSupportedNetworkId({
      networkId: _selectedNetworkId ?? '',
    });

    if (tokenInfo) {
      _selectedTokenInfo = tokenInfo;
    } else if (_selectedNetworkId && _selectedAccountId) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: _selectedNetworkId,
        accountId: _selectedAccountId,
      });
      if (nativeToken) {
        _selectedTokenInfo = nativeToken;
      }
    }

    setSelectedAccountId(_selectedAccountId);
    setSelectedNetworkId(_selectedNetworkId);
    setSelectedToken(_selectedTokenInfo);
  }, [
    accountId,
    activeAccount?.account?.id,
    activeAccount?.network?.id,
    networkId,
    setSelectedAccountId,
    setSelectedNetworkId,
    setSelectedToken,
    tokenInfo,
  ]);

  useEffect(() => {
    void initBulkSendInfo();
  }, [initBulkSendInfo]);

  return (
    <Page scrollEnabled>
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader />
          <AssetSelectorTrigger />
        </BulkSendContentWrapper>
      </Page.Body>
    </Page>
  );
}

function BulkSendAddressesInput() {
  const [selectedAccountId, setSelectedAccountId] = useState<
    string | undefined
  >(undefined);
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(undefined);
  const [selectedToken, setSelectedToken] = useState<IToken | undefined>(
    undefined,
  );
  const context = useMemo(
    () => ({
      selectedAccountId,
      setSelectedAccountId,
      selectedNetworkId,
      setSelectedNetworkId,
      selectedToken,
      setSelectedToken,
    }),
    [selectedAccountId, selectedNetworkId, selectedToken],
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BulkSendProviderMirror>
        <BulkSendContext.Provider value={context}>
          <BaseBulkSendAddressesInput />
        </BulkSendContext.Provider>
      </BulkSendProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default BulkSendAddressesInput;
