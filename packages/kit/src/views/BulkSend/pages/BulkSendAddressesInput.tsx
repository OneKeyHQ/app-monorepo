import { useCallback, useEffect, useMemo, useState } from 'react';

import { Form, Page, YStack, useForm } from '@onekeyhq/components';
import type {
  EModalBulkSendRoutes,
  IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import SenderAddressesInput from '../components/AddressesInput/SenderAddressesInput';
import AssetSelectorTrigger from '../components/AssetSelectorTrigger';
import BulkSendBar from '../components/BulkSendBar';
import BulkSendContentWrapper from '../components/BulkSendContentWrapper';
import {
  BulkSendContext,
  useBulkSendContext,
} from '../components/BulkSendContext';
import BulkSendHeader from '../components/BulkSendHeader';

function BaseBulkSendAddressesInput() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAddressesInput
  >();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const { accountId, networkId, indexedAccountId, tokenInfo } =
    route.params ?? {};

  const {
    setSelectedAccountId,
    setSelectedNetworkId,
    setSelectedToken,
    setSelectedIndexedAccountId,
    setSelectedTokenDetail,
    setTokenDetailsState,
    selectedToken,
    selectedNetworkId,
    selectedAccountId,
    tokenDetailsState,
  } = useBulkSendContext();

  const form = useForm({
    defaultValues: {
      senderAddresses: '',
      receiverAddresses: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const initBulkSendInfo = useCallback(async () => {
    let _selectedAccountId: string | undefined;
    let _selectedNetworkId: string | undefined;
    let _selectedTokenInfo: IToken | undefined;
    let _selectedIndexedAccountId: string | undefined;

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

    if (indexedAccountId) {
      _selectedIndexedAccountId = indexedAccountId;
    } else if (activeAccount?.account?.indexedAccountId) {
      _selectedIndexedAccountId = activeAccount?.account?.indexedAccountId;
    }

    if (tokenInfo) {
      _selectedTokenInfo = tokenInfo;
    } else if (_selectedNetworkId && _selectedAccountId) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: _selectedNetworkId,
        accountId: _selectedAccountId,
        tokenInfoOnly: true,
      });
      if (nativeToken) {
        _selectedTokenInfo = nativeToken;
      }
    }

    setSelectedAccountId(_selectedAccountId);
    setSelectedNetworkId(_selectedNetworkId);
    setSelectedToken(_selectedTokenInfo);
    setSelectedIndexedAccountId(_selectedIndexedAccountId);
  }, [
    accountId,
    activeAccount?.account?.id,
    activeAccount?.account?.indexedAccountId,
    activeAccount?.network?.id,
    networkId,
    indexedAccountId,
    tokenInfo,
    setSelectedAccountId,
    setSelectedNetworkId,
    setSelectedToken,
    setSelectedIndexedAccountId,
  ]);

  const fetchSelectedTokenFiatInfo = useCallback(async () => {
    if (selectedAccountId && selectedNetworkId && selectedToken) {
      setTokenDetailsState({ initialized: false, isRefreshing: true });
      const [checkInscriptionProtectionEnabled, vaultSettings] =
        await Promise.all([
          backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled({
            networkId: selectedNetworkId,
            accountId: selectedAccountId,
          }),
          backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: selectedNetworkId,
          }),
        ]);
      const withCheckInscription =
        checkInscriptionProtectionEnabled && vaultSettings.hasFrozenBalance;

      try {
        const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
          contractList: [selectedToken.address],
          withFrozenBalance: true,
          withCheckInscription,
        });

        if (resp[0]) {
          setSelectedTokenDetail(resp[0]);
        } else {
          setSelectedTokenDetail(undefined);
        }
      } catch (e) {
        setSelectedTokenDetail(undefined);
      } finally {
        setTokenDetailsState({
          initialized: true,
          isRefreshing: false,
        });
      }
    }
  }, [
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setSelectedTokenDetail,
    setTokenDetailsState,
  ]);

  const fetchSelectedAccountAddress = useCallback(async () => {
    if (selectedAccountId && selectedNetworkId) {
      const address =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
        });
      form.setValue('senderAddresses', address);
    }
  }, [form, selectedAccountId, selectedNetworkId]);

  useEffect(() => {
    void initBulkSendInfo();
  }, [initBulkSendInfo]);

  useEffect(() => {
    if (selectedAccountId && selectedNetworkId && selectedToken) {
      void fetchSelectedTokenFiatInfo();
    }
  }, [
    fetchSelectedTokenFiatInfo,
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
  ]);

  useEffect(() => {
    if (selectedAccountId && selectedNetworkId) {
      void fetchSelectedAccountAddress();
    }
  }, [fetchSelectedAccountAddress, selectedAccountId, selectedNetworkId]);

  const isSubmitDisabled = useMemo(() => {
    return !form.formState.isValid || !tokenDetailsState.initialized;
  }, [form.formState.isValid, tokenDetailsState.initialized]);

  const handleSubmit = useCallback(() => {
    // TODO: Implement next step
    console.log('handleSubmit');
  }, []);

  return (
    <Page scrollEnabled>
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader />
          <YStack gap="$6" $gtMd={{ gap: '$8' }}>
            <AssetSelectorTrigger />
            <Form form={form}>
              <SenderAddressesInput />
            </Form>
          </YStack>
        </BulkSendContentWrapper>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText="Next"
          confirmButtonProps={{
            onPress: handleSubmit,
            disabled: isSubmitDisabled,
          }}
        />
      </Page.Footer>
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
  const [selectedIndexedAccountId, setSelectedIndexedAccountId] = useState<
    string | undefined
  >(undefined);

  const [selectedTokenDetail, setSelectedTokenDetail] = useState<
    ({ info: IToken } & ITokenFiat) | undefined
  >(undefined);

  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: false,
    isRefreshing: false,
  });

  const context = useMemo(
    () => ({
      selectedAccountId,
      setSelectedAccountId,
      selectedNetworkId,
      setSelectedNetworkId,
      selectedToken,
      setSelectedToken,
      selectedIndexedAccountId,
      setSelectedIndexedAccountId,
      selectedTokenDetail,
      setSelectedTokenDetail,
      tokenDetailsState,
      setTokenDetailsState,
    }),
    [
      selectedAccountId,
      selectedNetworkId,
      selectedToken,
      selectedIndexedAccountId,
      selectedTokenDetail,
      setSelectedAccountId,
      setSelectedNetworkId,
      setSelectedToken,
      setSelectedIndexedAccountId,
      setSelectedTokenDetail,
      tokenDetailsState,
      setTokenDetailsState,
    ],
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BulkSendContext.Provider value={context}>
        <BaseBulkSendAddressesInput />
      </BulkSendContext.Provider>
    </AccountSelectorProviderMirror>
  );
}

export default BulkSendAddressesInput;
