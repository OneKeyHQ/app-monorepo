import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import { useIntl } from 'react-intl';

import { Form, Page, YStack, useForm, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EmptyNoWalletView } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOKEN,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalBulkSendParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalBulkSendRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { useBulkSendMobileHeader } from '../../components/BulkSendMobileHeader';

import ReceiverAddressesInput from './components/AddressesInput/ReceiverAddressesInput';
import SenderAddressesInput from './components/AddressesInput/SenderAddressesInput';
import AssetSelectorTrigger from './components/AssetSelectorTrigger';
import {
  BulkSendAddressesInputContext,
  useBulkSendAddressesInputContext,
} from './components/Context';

function BaseBulkSendAddressesInput() {
  const intl = useIntl();
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAddressesInput
  >();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const { accountId, networkId, indexedAccountId, tokenInfo, isInModal } =
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
    selectedTokenDetail,
    tokenDetailsState,
    bulkSendMode,
  } = useBulkSendAddressesInputContext();

  const media = useMedia();
  const { headerTitle } = useBulkSendMobileHeader({ bulkSendMode });

  const { result: availableWallets } = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreEmptySingletonWalletAccounts: true,
      ignoreNonBackedUpWallets: true,
    });
    return wallets.filter(
      (w) =>
        !accountUtils.isQrWallet({ walletId: w.id }) &&
        !accountUtils.isOthersWallet({ walletId: w.id }) &&
        !w.deprecated,
    );
  }, []);

  const form = useForm({
    defaultValues: {
      senderAddresses: '',
      receiverAddresses: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const navigation = useAppNavigation();

  const initBulkSendInfo = useCallback(async () => {
    let _selectedAccountId: string | undefined;
    let _selectedNetworkId: string | undefined;
    let _selectedTokenInfo: IToken | undefined;
    let _selectedIndexedAccountId: string | undefined;
    let isAllNetwork = false;

    if (networkId) {
      _selectedNetworkId = networkId;
    } else {
      _selectedNetworkId = activeAccount?.network?.id;
    }

    if (accountId) {
      _selectedAccountId = accountId;
    } else if (activeAccount?.account?.id) {
      _selectedAccountId = activeAccount?.account?.id;
    }

    if (
      _selectedNetworkId &&
      networkUtils.isAllNetwork({ networkId: _selectedNetworkId })
    ) {
      isAllNetwork = true;
    }

    const { fixedNetworkId, isSupported } =
      bulkSendUtils.fixBulkSendSupportedNetworkId({
        networkId: _selectedNetworkId ?? '',
      });

    _selectedNetworkId = fixedNetworkId;

    if (indexedAccountId) {
      _selectedIndexedAccountId = indexedAccountId;
    } else if (activeAccount?.account?.indexedAccountId) {
      _selectedIndexedAccountId = activeAccount?.account?.indexedAccountId;
    }

    if (!isSupported && _selectedNetworkId && _selectedIndexedAccountId) {
      const networkAccounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          {
            networkIds: [_selectedNetworkId],
            indexedAccountId: _selectedIndexedAccountId,
          },
        );
      if (networkAccounts?.[0]?.account) {
        _selectedAccountId = networkAccounts?.[0]?.account?.id;
      }
    }

    if (
      isAllNetwork &&
      !accountUtils.isOthersAccount({ accountId: _selectedAccountId })
    ) {
      const networkAccounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          {
            networkIds: [_selectedNetworkId ?? ''],
            indexedAccountId: _selectedIndexedAccountId ?? '',
          },
        );
      _selectedAccountId = networkAccounts[0].account?.id ?? '';
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

  // Reset token details state when account/network/token changes
  /* eslint-disable react-hooks/exhaustive-deps */
  /* oxlint-disable react/exhaustive-deps */
  useEffect(() => {
    if (selectedAccountId && selectedNetworkId && selectedToken) {
      setTokenDetailsState({
        initialized: false,
        isRefreshing: true,
      });
      void form.trigger();
    }
  }, [
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setTokenDetailsState,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
  /* oxlint-enable react/exhaustive-deps */

  usePromiseResult(
    async () => {
      if (
        selectedAccountId &&
        selectedNetworkId &&
        selectedToken &&
        availableWallets?.length
      ) {
        console.log('addresses input fetchSelectedTokenFiatInfo');

        const [checkInscriptionProtectionEnabled, vaultSettings] =
          await Promise.all([
            backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
              {
                networkId: selectedNetworkId,
                accountId: selectedAccountId,
              },
            ),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: selectedNetworkId,
            }),
          ]);
        const withCheckInscription =
          checkInscriptionProtectionEnabled && vaultSettings.hasFrozenBalance;

        try {
          const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails(
            {
              accountId: selectedAccountId,
              networkId: selectedNetworkId,
              contractList: [selectedToken.address],
              withFrozenBalance: true,
              withCheckInscription,
            },
          );

          if (resp[0]) {
            setSelectedTokenDetail(resp[0]);
          } else {
            setSelectedTokenDetail(undefined);
          }
        } catch (_) {
          setSelectedTokenDetail(undefined);
        } finally {
          setTokenDetailsState({
            initialized: true,
            isRefreshing: false,
          });
        }
      }
    },
    [
      availableWallets,
      selectedAccountId,
      selectedNetworkId,
      selectedToken,
      setSelectedTokenDetail,
      setTokenDetailsState,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  const fetchSelectedAccountAddress = useCallback(async () => {
    if (selectedAccountId && selectedNetworkId) {
      const address =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
        });
      form.setValue('senderAddresses', address);
      void form.trigger('senderAddresses');
    }
  }, [form, selectedAccountId, selectedNetworkId]);

  useEffect(() => {
    void initBulkSendInfo();
  }, [initBulkSendInfo]);

  useEffect(() => {
    if (selectedAccountId && selectedNetworkId) {
      void fetchSelectedAccountAddress();
    }
  }, [fetchSelectedAccountAddress, selectedAccountId, selectedNetworkId]);

  const isSubmitDisabled = useMemo(() => {
    const isTokenLoading =
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !selectedTokenDetail);
    return (
      !form.formState.isValid || form.formState.isValidating || isTokenLoading
    );
  }, [
    form.formState.isValid,
    form.formState.isValidating,
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    selectedTokenDetail,
  ]);

  const handleSubmit = useCallback(async () => {
    if (
      !selectedNetworkId ||
      !selectedAccountId ||
      !selectedToken ||
      !selectedTokenDetail
    ) {
      return;
    }

    const formValues = form.getValues();
    const senders = formValues.senderAddresses
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [address] = line.trim().split(',');
        return { address: address.trim(), amount: undefined };
      });
    const receivers = formValues.receiverAddresses
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [address, amount] = line.trim().split(',');
        return {
          address: address.trim(),
          amount: isUndefined(amount)
            ? amount
            : new BigNumber(amount).toFixed(),
        };
      });

    if (isInModal) {
      navigation.push(EModalBulkSendRoutes.BulkSendAmountsInput, {
        networkId: selectedNetworkId,
        accountId: selectedAccountId,
        senders,
        receivers,
        tokenInfo: selectedToken,
        tokenDetails: selectedTokenDetail,
        bulkSendMode,
        isInModal,
      });
    } else {
      navigation.switchTab(ETabRoutes.Home);
      await timerUtils.wait(50);
      navigation.push(ETabHomeRoutes.TabHomeBulkSendAmountsInput, {
        networkId: selectedNetworkId,
        accountId: selectedAccountId,
        senders,
        receivers,
        tokenInfo: selectedToken,
        tokenDetails: selectedTokenDetail,
        bulkSendMode,
      });
    }
  }, [
    form,
    selectedNetworkId,
    selectedAccountId,
    selectedToken,
    selectedTokenDetail,
    navigation,
    bulkSendMode,
    isInModal,
  ]);

  if (availableWallets && availableWallets.length === 0) {
    return (
      <Page>
        {media.gtMd ? null : <Page.Header headerTitle={headerTitle} />}
        <Page.Body>
          <EmptyNoWalletView />
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      {media.gtMd ? null : <Page.Header headerTitle={headerTitle} />}
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader bulkSendMode={bulkSendMode} />
          <YStack gap="$6" $gtMd={{ gap: '$8' }}>
            <AssetSelectorTrigger />
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.addressInput,
                sceneUrl: '',
              }}
              enabledNum={[0, 1]}
              availableNetworksMap={{
                0: {
                  networkIds: [selectedNetworkId ?? ''],
                  defaultNetworkId: selectedNetworkId,
                },
                1: {
                  networkIds: [selectedNetworkId ?? ''],
                  defaultNetworkId: selectedNetworkId,
                },
              }}
            >
              <Form form={form}>
                <SenderAddressesInput />
                <ReceiverAddressesInput
                  maxLines={platformEnv.isNativeAndroid ? 100 : 500}
                />
              </Form>
            </AccountSelectorProviderMirror>
          </YStack>
        </BulkSendContentWrapper>
      </Page.Body>
      <Page.Footer borderTopWidth={1} borderColor="$borderDefault">
        <BulkSendContentWrapper
          $gtMd={{
            mt: '$0',
            px: '$0',
            mx: 'auto',
            maxWidth: '$180',
          }}
        >
          <Page.FooterActions
            px="$0"
            onConfirmText={intl.formatMessage({
              id: ETranslations.wallet_bulk_send_btn_next,
            })}
            confirmButtonProps={{
              onPress: handleSubmit,
              disabled: isSubmitDisabled,
            }}
          />
        </BulkSendContentWrapper>
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
  const [bulkSendMode, setBulkSendMode] = useState<EBulkSendMode>(
    EBulkSendMode.OneToMany,
  );

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
      bulkSendMode,
      setBulkSendMode,
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
      bulkSendMode,
      setBulkSendMode,
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
      <BulkSendAddressesInputContext.Provider value={context}>
        <BaseBulkSendAddressesInput />
      </BulkSendAddressesInputContext.Provider>
    </AccountSelectorProviderMirror>
  );
}

export default BulkSendAddressesInput;
