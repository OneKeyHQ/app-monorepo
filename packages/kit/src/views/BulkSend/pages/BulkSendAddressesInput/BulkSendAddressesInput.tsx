import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Form,
  Page,
  Toast,
  YStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EmptyNoWalletView } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
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
import { useBulkSendModeDialog } from '../../hooks/useBulkSendModeDialog';
import { isBulkSendTokenDetailsMatched } from '../../utils';

import ReceiverAddressesInput from './components/AddressesInput/ReceiverAddressesInput';
import SenderAddressesInput from './components/AddressesInput/SenderAddressesInput';
import AssetSelectorTrigger from './components/AssetSelectorTrigger';
import {
  BulkSendAddressesInputContext,
  useBulkSendAddressesInputContext,
} from './components/Context';

import type { ILineError } from './components/AddressesInput/LineNumberedTextArea';
import type { IResolvedSenderAccount } from './components/Context';

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
    setBulkSendMode,
    duplicateAddressCount,
    setDuplicateAddressCount,
    setSelectedDeriveType,
    resolvedSenderAccountIds,
    setResolvedSenderAccountIds,
    duplicateSenderAddressCount,
    setDuplicateSenderAddressCount,
    setHasUserSelectedAsset,
    setReceiverValidationErrors,
  } = useBulkSendAddressesInputContext();

  const media = useMedia();
  const showBulkSendModeDialog = useBulkSendModeDialog();

  const handleChangeBulkSendMode = useCallback(() => {
    showBulkSendModeDialog({
      onSelect: (mode) => {
        setBulkSendMode(mode);
      },
    });
  }, [showBulkSendModeDialog, setBulkSendMode]);

  const { headerTitle, headerRight } = useBulkSendMobileHeader({
    bulkSendMode,
    onChangeBulkSendMode: handleChangeBulkSendMode,
  });

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
  const senderAddressesRef = useRef(form.getValues('senderAddresses') ?? '');
  const getSenderAddresses = useCallback(
    () => senderAddressesRef.current ?? '',
    [],
  );

  const navigation = useAppNavigation();

  useEffect(() => {
    const subscription = form.watch((values) => {
      senderAddressesRef.current = values.senderAddresses ?? '';
    });

    return () => subscription.unsubscribe();
  }, [form]);

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
        bulkSendMode,
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
    setHasUserSelectedAsset(false);
  }, [
    accountId,
    activeAccount?.account?.id,
    activeAccount?.account?.indexedAccountId,
    activeAccount?.network?.id,
    networkId,
    indexedAccountId,
    tokenInfo,
    bulkSendMode,
    setSelectedAccountId,
    setSelectedNetworkId,
    setSelectedToken,
    setSelectedIndexedAccountId,
    setHasUserSelectedAsset,
  ]);

  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const validationDependencyKey = useMemo(
    () =>
      [
        selectedNetworkId ?? '',
        selectedToken?.networkId ?? '',
        selectedToken?.address ?? '',
        selectedToken?.decimals ?? '',
        selectedToken?.isNative ? '1' : '0',
      ].join(':'),
    [
      selectedNetworkId,
      selectedToken?.networkId,
      selectedToken?.address,
      selectedToken?.decimals,
      selectedToken?.isNative,
    ],
  );
  const previousValidationDependencyKeyRef = useRef<string | undefined>(
    undefined,
  );
  const tokenDetailsRequestIdRef = useRef(0);

  // Reset token details state when account/network/token changes (OneToMany only)
  /* eslint-disable react-hooks/exhaustive-deps */
  /* oxlint-disable react/exhaustive-deps */
  useEffect(() => {
    if (
      isOneToMany &&
      selectedAccountId &&
      selectedNetworkId &&
      selectedToken
    ) {
      setSelectedTokenDetail(undefined);
      tokenDetailsRequestIdRef.current += 1;
      setTokenDetailsState({
        initialized: false,
        isRefreshing: true,
      });
      void form.trigger();
    }
  }, [
    isOneToMany,
    selectedAccountId,
    selectedNetworkId,
    selectedToken,
    setTokenDetailsState,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */
  /* oxlint-enable react/exhaustive-deps */

  // Balance polling — only needed for OneToMany mode
  usePromiseResult(
    async () => {
      if (!isOneToMany) return;
      if (
        selectedAccountId &&
        selectedNetworkId &&
        selectedToken &&
        availableWallets?.length
      ) {
        const requestId = tokenDetailsRequestIdRef.current + 1;
        tokenDetailsRequestIdRef.current = requestId;
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

          if (tokenDetailsRequestIdRef.current !== requestId) {
            return;
          }

          if (
            resp[0] &&
            isBulkSendTokenDetailsMatched(
              {
                networkId: selectedNetworkId,
                tokenInfo: selectedToken,
              },
              resp[0],
            )
          ) {
            setSelectedTokenDetail(resp[0]);
          } else {
            setSelectedTokenDetail(undefined);
          }
        } catch (_) {
          if (tokenDetailsRequestIdRef.current !== requestId) {
            return;
          }
          setSelectedTokenDetail(undefined);
        } finally {
          if (tokenDetailsRequestIdRef.current === requestId) {
            setTokenDetailsState({
              initialized: true,
              isRefreshing: false,
            });
          }
        }
      }
    },
    [
      isOneToMany,
      availableWallets,
      selectedAccountId,
      selectedNetworkId,
      selectedToken,
      setSelectedTokenDetail,
      setTokenDetailsState,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: isOneToMany ? POLLING_INTERVAL_FOR_TOKEN : undefined,
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
    if (selectedNetworkId && networkUtils.isBTCNetwork(selectedNetworkId)) {
      void backgroundApiProxy.serviceNetwork
        .getGlobalDeriveTypeOfNetwork({ networkId: selectedNetworkId })
        .then((deriveType) => {
          setSelectedDeriveType(deriveType);
        });
    } else {
      setSelectedDeriveType(undefined);
    }
  }, [selectedNetworkId, setSelectedDeriveType]);

  useEffect(() => {
    if (isOneToMany && selectedAccountId && selectedNetworkId) {
      void fetchSelectedAccountAddress();
    }
  }, [
    isOneToMany,
    fetchSelectedAccountAddress,
    selectedAccountId,
    selectedNetworkId,
  ]);

  useEffect(() => {
    const previousValidationDependencyKey =
      previousValidationDependencyKeyRef.current;
    previousValidationDependencyKeyRef.current = validationDependencyKey;

    if (
      previousValidationDependencyKey === undefined ||
      previousValidationDependencyKey === validationDependencyKey
    ) {
      return;
    }

    setResolvedSenderAccountIds({});

    const senderAddressesValue = form.getValues('senderAddresses');
    const receiverAddressesValue = form.getValues('receiverAddresses');

    if (!isOneToMany && senderAddressesValue.trim()) {
      void form.trigger('senderAddresses');
    }

    if (receiverAddressesValue.trim()) {
      void form.trigger('receiverAddresses');
    }
  }, [form, isOneToMany, setResolvedSenderAccountIds, validationDependencyKey]);

  // Reset form when mode changes
  /* eslint-disable react-hooks/exhaustive-deps */
  /* oxlint-disable react/exhaustive-deps */
  useEffect(() => {
    form.setValue('senderAddresses', '');
    form.setValue('receiverAddresses', '');
    form.clearErrors();
    setDuplicateAddressCount(0);
    setDuplicateSenderAddressCount(0);
    setHasUserSelectedAsset(false);
    setSelectedTokenDetail(undefined);
    setReceiverValidationErrors([]);
    if (isOneToMany && selectedAccountId && selectedNetworkId) {
      void fetchSelectedAccountAddress();
      setTokenDetailsState({ initialized: false, isRefreshing: true });
    } else {
      setTokenDetailsState({ initialized: true, isRefreshing: false });
    }
  }, [bulkSendMode]);
  /* eslint-enable react-hooks/exhaustive-deps */
  /* oxlint-enable react/exhaustive-deps */

  const isSubmitDisabled = useMemo(() => {
    const baseDisabled = !form.formState.isValid || form.formState.isValidating;
    if (isOneToMany) {
      const isTokenLoading =
        !tokenDetailsState.initialized ||
        (tokenDetailsState.isRefreshing && !selectedTokenDetail);
      return baseDisabled || isTokenLoading;
    }
    return baseDisabled;
  }, [
    form.formState.isValid,
    form.formState.isValidating,
    isOneToMany,
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    selectedTokenDetail,
  ]);

  const navigateToNextStep = useCallback(async () => {
    if (!selectedNetworkId || !selectedToken) {
      return;
    }

    // For OneToMany, require selectedAccountId and selectedTokenDetail
    if (isOneToMany && (!selectedAccountId || !selectedTokenDetail)) {
      return;
    }

    // For non-OneToMany, selectedAccountId is not from single-line wallet lookup
    if (!isOneToMany && !selectedAccountId) {
      return;
    }

    const formValues = form.getValues();

    // Parse sender addresses — extract amounts for ManyToOne/ManyToMany
    let senderLineIndex = 0;
    const senders = formValues.senderAddresses
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [address, amount] = line.trim().split(',');
        const currentIndex = senderLineIndex;
        senderLineIndex += 1;
        return {
          address: address.trim(),
          amount:
            !isOneToMany && amount !== undefined
              ? new BigNumber(amount.trim()).toFixed()
              : undefined,
          accountId: resolvedSenderAccountIds[currentIndex]?.accountId,
        };
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

    // ManyToMany: defensive count check
    if (
      bulkSendMode === EBulkSendMode.ManyToMany &&
      senders.length !== receivers.length
    ) {
      Toast.error({
        title: intl.formatMessage(
          {
            id: ETranslations.wallet_bulk_send_error_sender_receiver_count_mismatch,
          },
          { senders: senders.length, receivers: receivers.length },
        ),
      });
      return;
    }

    let resolvedTokenDetails = selectedTokenDetail;

    if (
      !resolvedTokenDetails &&
      selectedAccountId &&
      selectedNetworkId &&
      selectedToken
    ) {
      try {
        const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
          contractList: [selectedToken.address],
          withFrozenBalance: false,
          withCheckInscription: false,
        });

        if (
          resp[0] &&
          isBulkSendTokenDetailsMatched(
            {
              networkId: selectedNetworkId,
              tokenInfo: selectedToken,
            },
            resp[0],
          )
        ) {
          resolvedTokenDetails = resp[0];
          setSelectedTokenDetail(resp[0]);
        }
      } catch (_) {
        resolvedTokenDetails = undefined;
      }
    }

    // For non-OneToMany, construct minimal tokenDetails if not available
    const effectiveTokenDetails =
      resolvedTokenDetails ??
      ({
        info: selectedToken,
        balance: '0',
        balanceParsed: '0',
        fiatValue: '0',
        price: 0,
        price24h: 0,
        value: '0',
        value24h: '0',
      } as { info: IToken } & ITokenFiat);

    const navParams = {
      networkId: selectedNetworkId,
      accountId: selectedAccountId ?? '',
      senders,
      receivers,
      tokenInfo: selectedToken,
      tokenDetails: effectiveTokenDetails,
      bulkSendMode,
      hasDuplicateSenders: duplicateSenderAddressCount > 0,
    };

    if (isInModal) {
      navigation.push(EModalBulkSendRoutes.BulkSendAmountsInput, {
        ...navParams,
        isInModal,
      });
    } else {
      navigation.switchTab(ETabRoutes.Home);
      await timerUtils.wait(50);
      navigation.push(ETabHomeRoutes.TabHomeBulkSendAmountsInput, navParams);
    }
  }, [
    form,
    selectedNetworkId,
    selectedAccountId,
    selectedToken,
    selectedTokenDetail,
    navigation,
    bulkSendMode,
    isOneToMany,
    isInModal,
    setSelectedTokenDetail,
    resolvedSenderAccountIds,
    duplicateSenderAddressCount,
    intl,
  ]);

  const handleSubmit = useCallback(async () => {
    if (duplicateAddressCount > 0) {
      Dialog.show({
        icon: 'InfoCircleOutline',
        tone: 'warning',
        title: intl.formatMessage({
          id: ETranslations.global_warning,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.wallet_bulk_send_warning_duplicate_addresses_desc,
          },
          { count: duplicateAddressCount },
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          void navigateToNextStep();
        },
      });
      return;
    }
    await navigateToNextStep();
  }, [duplicateAddressCount, intl, navigateToNextStep]);

  if (availableWallets && availableWallets.length === 0) {
    return (
      <Page>
        {media.gtMd ? null : (
          <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
        )}
        <Page.Body>
          <EmptyNoWalletView />
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      {media.gtMd ? null : (
        <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
      )}
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader
            bulkSendMode={bulkSendMode}
            onChangeBulkSendMode={handleChangeBulkSendMode}
          />
          <YStack gap="$6" $gtMd={{ gap: '$8' }}>
            <AssetSelectorTrigger
              getSenderAddresses={getSenderAddresses}
              activeAccountId={activeAccount?.account?.id}
              activeIndexedAccountId={activeAccount?.indexedAccount?.id}
            />
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

function BulkSendAddressesInputProvider() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAddressesInput
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

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

  const initialMode = route.params?.bulkSendMode ?? EBulkSendMode.OneToMany;
  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: initialMode !== EBulkSendMode.OneToMany,
    isRefreshing: initialMode === EBulkSendMode.OneToMany,
  });
  const [bulkSendMode, setBulkSendMode] = useState<EBulkSendMode>(initialMode);
  const [duplicateAddressCount, setDuplicateAddressCount] = useState(0);
  const [selectedDeriveType, setSelectedDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(undefined);

  const [resolvedSenderAccountIds, setResolvedSenderAccountIds] = useState<
    Record<number, IResolvedSenderAccount>
  >({});

  const [duplicateSenderAddressCount, setDuplicateSenderAddressCount] =
    useState(0);

  const [hasUserSelectedAsset, setHasUserSelectedAsset] = useState(false);
  const [receiverValidationErrors, setReceiverValidationErrors] = useState<
    ILineError[]
  >([]);

  const context = useMemo(
    () => ({
      currentWalletId: selectedAccountId
        ? accountUtils.getWalletIdFromAccountId({
            accountId: selectedAccountId,
          })
        : activeAccount?.wallet?.id,
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
      duplicateAddressCount,
      setDuplicateAddressCount,
      selectedDeriveType,
      setSelectedDeriveType,
      resolvedSenderAccountIds,
      setResolvedSenderAccountIds,
      duplicateSenderAddressCount,
      setDuplicateSenderAddressCount,
      hasUserSelectedAsset,
      setHasUserSelectedAsset,
      receiverValidationErrors,
      setReceiverValidationErrors,
    }),
    [
      activeAccount?.wallet?.id,
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
      duplicateAddressCount,
      setDuplicateAddressCount,
      selectedDeriveType,
      resolvedSenderAccountIds,
      duplicateSenderAddressCount,
      hasUserSelectedAsset,
      receiverValidationErrors,
    ],
  );

  return (
    <BulkSendAddressesInputContext.Provider value={context}>
      <BaseBulkSendAddressesInput />
    </BulkSendAddressesInputContext.Provider>
  );
}

function BulkSendAddressesInput() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BulkSendAddressesInputProvider />
    </AccountSelectorProviderMirror>
  );
}

export default BulkSendAddressesInput;
