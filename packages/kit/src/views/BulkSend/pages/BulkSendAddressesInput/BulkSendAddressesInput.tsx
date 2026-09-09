import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Form,
  Page,
  Toast,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EmptyNoWalletView } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView';
import { useInscriptionProtectionStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type {
  IBulkSendAddressesInputSeed,
  IBulkSendAddressesInputSeedNetwork,
  IBulkSendAddressesInputSeedSender,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { useBulkSendMobileHeader } from '../../components/BulkSendMobileHeader';
import { useBulkSendModeDialog } from '../../hooks/useBulkSendModeDialog';
import { isBulkSendTokenDetailsMatched } from '../../utils';

import { parseBulkSendAddressLines } from './addressLineUtils';
import {
  buildBulkSendFallbackSeed,
  buildBulkSendSeedSource,
  buildBulkSendSeedTokenKey,
  computeBulkSendNextDisabled,
  resolveBulkSendSeedApplyPlan,
} from './bulkSendSeedUtils';
import ReceiverAddressesInput from './components/AddressesInput/ReceiverAddressesInput';
import SenderAddressesInput from './components/AddressesInput/SenderAddressesInput';
import AssetSelectorTrigger from './components/AssetSelectorTrigger';
import { BulkSendFormSkeleton } from './components/BulkSendFormSkeleton';
import {
  BulkSendAddressesInputContext,
  useBulkSendAddressesInputContext,
} from './components/Context';
import { buildBulkSendHomeAccountSeedKey } from './homeAccountSeedUtils';

import type { ILineError } from './components/AddressesInput/LineNumberedTextArea';
import type {
  IBulkSendAddressesFormValues,
  IResolvedSenderAccount,
} from './components/Context';
import type { UseFormReturn } from 'react-hook-form';

type IBulkSendAddressesForm = UseFormReturn<IBulkSendAddressesFormValues>;

type IAppliedSeed = {
  key: string;
  seed: IBulkSendAddressesInputSeed;
};

function BaseBulkSendAddressesInput({
  form,
}: {
  form: IBulkSendAddressesForm;
}) {
  const intl = useIntl();
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAddressesInput
  >();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const [inscriptionProtectionState] = useInscriptionProtectionStateAtom();

  const { isInModal } = route.params ?? {};

  const {
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
    isInitializing,
    seededAccountId,
    seededNetworkId,
    seededSender,
    isSenderFieldMounted,
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

  // Re-validate the fields that already hold content: only the sender and
  // receiver entries depend on the account / network / token. An empty
  // field is left alone so entering the page never shows a "required"
  // error the user has not earned yet (OK-61587).
  const triggerFilledFields = useCallback(() => {
    const { senderAddresses, receiverAddresses } = form.getValues();
    if (senderAddresses.trim()) {
      void form.trigger('senderAddresses');
    }
    if (receiverAddresses.trim()) {
      void form.trigger('receiverAddresses');
    }
  }, [form]);

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
      triggerFilledFields();
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

        const [effectiveInscriptionProtection, vaultSettings] =
          await Promise.all([
            backgroundApiProxy.serviceSetting.getEffectiveInscriptionProtection(
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
          effectiveInscriptionProtection && vaultSettings.hasFrozenBalance;

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
    // The policy state is an intentional invalidation signal; bg computes the final value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      isOneToMany,
      availableWallets,
      selectedAccountId,
      selectedNetworkId,
      selectedToken,
      setSelectedTokenDetail,
      setTokenDetailsState,
      inscriptionProtectionState.localEnabled,
      inscriptionProtectionState.serverEnabled,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: isOneToMany ? POLLING_INTERVAL_FOR_TOKEN : undefined,
    },
  );

  const senderAddressRequestIdRef = useRef(0);
  const fetchSelectedAccountAddress = useCallback(async () => {
    if (!selectedAccountId || !selectedNetworkId) {
      return;
    }
    // Only the latest selection may write the field: a slow lookup for a
    // previous account must not land over a newer pick.
    senderAddressRequestIdRef.current += 1;
    const requestId = senderAddressRequestIdRef.current;
    try {
      const address =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: selectedAccountId,
          networkId: selectedNetworkId,
        });
      if (senderAddressRequestIdRef.current !== requestId) {
        return;
      }
      form.setValue('senderAddresses', address);
      void form.trigger('senderAddresses');
    } catch {
      // Keep whatever the field holds; validation reports its state.
    }
  }, [form, selectedAccountId, selectedNetworkId]);

  // The sender address-type chip follows the resolved sender account (picked,
  // pasted or seeded), falling back to the network default only when there is
  // no account yet. Reading the default alone left the chip stale once the
  // sender changed (OK-61627).
  useEffect(() => {
    if (!selectedNetworkId || !networkUtils.isBTCNetwork(selectedNetworkId)) {
      setSelectedDeriveType(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      let deriveType: IAccountDeriveTypes | undefined;
      if (selectedAccountId) {
        try {
          const dbAccount =
            await backgroundApiProxy.serviceAccount.getDBAccount({
              accountId: selectedAccountId,
            });
          deriveType = (
            await backgroundApiProxy.serviceNetwork.getDeriveTypeByDBAccount({
              networkId: selectedNetworkId,
              account: dbAccount,
            })
          ).deriveType;
        } catch {
          // fall through to the network default
        }
      }
      if (!deriveType) {
        deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: selectedNetworkId,
          });
      }
      if (!cancelled) {
        setSelectedDeriveType(deriveType);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, selectedNetworkId, setSelectedDeriveType]);

  useEffect(() => {
    // Any selection / mode change supersedes an in-flight lookup: its late
    // response must not refill a field the mode reset just cleared.
    senderAddressRequestIdRef.current += 1;
    if (!isOneToMany || !selectedAccountId || !selectedNetworkId) {
      return;
    }
    // The seed wrote the address for its own selection in the same commit
    // as the token, so the lookup is redundant only while the field still
    // holds that address. Switching to another account and back (account /
    // network / address type picker) or a mode reset leaves a different
    // value in the field and must refresh it; skipping on the seed identity
    // alone kept the previous account's address in the form.
    if (
      selectedAccountId === seededAccountId &&
      selectedNetworkId === seededNetworkId &&
      Boolean(seededSender?.address) &&
      form.getValues('senderAddresses') === seededSender?.address
    ) {
      return;
    }
    void fetchSelectedAccountAddress();
  }, [
    isOneToMany,
    fetchSelectedAccountAddress,
    form,
    selectedAccountId,
    selectedNetworkId,
    seededAccountId,
    seededNetworkId,
    seededSender?.address,
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

  // Reset form when the mode changes. The initial mount is skipped: the
  // provider seeds the page (and the sender address) itself, and marking the
  // token details as initialized before that seed lands used to open the
  // Next button on the first frame (OK-61587).
  const isFirstModeRunRef = useRef(true);
  /* eslint-disable react-hooks/exhaustive-deps */
  /* oxlint-disable react/exhaustive-deps */
  useEffect(() => {
    if (isFirstModeRunRef.current) {
      isFirstModeRunRef.current = false;
      return;
    }
    form.setValue('senderAddresses', '');
    form.setValue('receiverAddresses', '');
    form.clearErrors();
    setDuplicateAddressCount(0);
    setDuplicateSenderAddressCount(0);
    setHasUserSelectedAsset(false);
    setSelectedTokenDetail(undefined);
    setReceiverValidationErrors([]);
    setTokenDetailsState(
      isOneToMany
        ? { initialized: false, isRefreshing: true }
        : { initialized: true, isRefreshing: false },
    );
  }, [bulkSendMode]);
  /* eslint-enable react-hooks/exhaustive-deps */
  /* oxlint-enable react/exhaustive-deps */

  const isSubmitDisabled = useMemo(
    () =>
      computeBulkSendNextDisabled({
        isFormValid: form.formState.isValid,
        isFormValidating: form.formState.isValidating,
        isInitializing,
        isSenderFieldMounted,
        isOneToMany,
        tokenDetailsState,
        hasTokenDetail: Boolean(selectedTokenDetail),
      }),
    [
      form.formState.isValid,
      form.formState.isValidating,
      isInitializing,
      isSenderFieldMounted,
      isOneToMany,
      tokenDetailsState,
      selectedTokenDetail,
    ],
  );

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

    const senders = parseBulkSendAddressLines(formValues.senderAddresses).map(
      ({ address, amount }, index) => {
        return {
          address,
          amount:
            !isOneToMany && amount !== undefined
              ? new BigNumber(amount).toFixed()
              : undefined,
          accountId: resolvedSenderAccountIds[index]?.accountId,
        };
      },
    );

    const receivers = parseBulkSendAddressLines(
      formValues.receiverAddresses,
    ).map(({ address, amount }) => {
      return {
        address,
        amount: amount === undefined ? amount : new BigNumber(amount).toFixed(),
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

  const formSkeleton = useMemo(
    () => (
      <BulkSendFormSkeleton
        bulkSendMode={bulkSendMode}
        senderLabel={intl.formatMessage({
          id: isOneToMany
            ? ETranslations.wallet_bulk_send_section_sending_address
            : ETranslations.wallet_bulk_send_label_sending_addresses,
        })}
        receiverLabel={intl.formatMessage({
          id:
            bulkSendMode === EBulkSendMode.ManyToOne
              ? ETranslations.wallet_bulk_send_section_receiving_address
              : ETranslations.wallet_bulk_send_label_receiving_addresses,
        })}
      />
    ),
    [bulkSendMode, intl, isOneToMany],
  );

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
              storageReadyFallback={formSkeleton}
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
  const { accountId, networkId, indexedAccountId, tokenInfo } =
    route.params ?? {};

  const initialMode = route.params?.bulkSendMode ?? EBulkSendMode.OneToMany;
  const [bulkSendMode, setBulkSendMode] = useState<EBulkSendMode>(initialMode);

  const homeAccountSeedKey = buildBulkSendHomeAccountSeedKey({
    networkId: activeAccount?.network?.id,
    accountId: activeAccount?.account?.id,
    indexedAccountId:
      activeAccount?.account?.indexedAccountId ??
      activeAccount?.indexedAccount?.id,
  });
  // Snapshot of the home-scene account used to (re)seed this page. It only
  // refreshes when the account identity changes: a derive-type-only switch
  // (e.g. from the recipient picker's address-type menu) must not discard the
  // sender the user already chose (OK-61627).
  const homeSeedAccount = useMemo(
    () => ({
      accountId: activeAccount?.account?.id,
      indexedAccountId:
        activeAccount?.account?.indexedAccountId ??
        activeAccount?.indexedAccount?.id,
      networkId: activeAccount?.network?.id,
    }),
    // The seed key is the intentional invalidation signal.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [homeAccountSeedKey],
  );

  const seedSource = useMemo(
    () =>
      buildBulkSendSeedSource({
        routeParams: { networkId, accountId, indexedAccountId, tokenInfo },
        homeSeedAccount,
        bulkSendMode,
      }),
    [
      networkId,
      accountId,
      indexedAccountId,
      tokenInfo,
      homeSeedAccount,
      bulkSendMode,
    ],
  );
  const seedKey = swrKeys.bulkSendAddressesInputSeed({
    networkId: seedSource.networkId,
    accountId: seedSource.accountId,
    indexedAccountId: seedSource.indexedAccountId,
    bulkSendMode,
    tokenKey: buildBulkSendSeedTokenKey(tokenInfo),
  });
  const seedSourceRef = useRef(seedSource);
  seedSourceRef.current = seedSource;

  // One background round trip resolves everything the first frame needs;
  // the SWR snapshot makes re-entries paint complete immediately and the
  // fresh result only re-applies when it actually differs (OK-61587).
  const { result: seedResult } = usePromiseResult(
    async () => {
      // Echo the key so a late result for a previous selection can never
      // be applied under the current one.
      const key = seedKey;
      const source = seedSourceRef.current;
      try {
        const seed =
          await backgroundApiProxy.serviceBulkSend.getAddressesInputSeed(
            source,
          );
        // A lookup that lost the account (failed / empty remap) can only
        // mount an empty page; it must not replace a complete seed or be
        // snapshotted as one.
        const isDegraded = Boolean(source.accountId) && !seed.accountId;
        return { key, seed, isDegraded };
      } catch {
        // A rejected request must still settle the initializing gate, or
        // the sender stays a skeleton and Next stays disabled for the life
        // of the page. Mount on the raw source and let the user pick.
        return {
          key,
          seed: buildBulkSendFallbackSeed(source),
          isDegraded: true,
        };
      }
    },
    [seedKey],
    {
      swrKey: seedKey,
      checkIsFocused: false,
      // Never snapshot a degraded result: the next entry retries the lookup.
      swrShouldPersist: (result) => !result.isDegraded,
    },
  );
  const seed = seedResult?.key === seedKey ? seedResult.seed : undefined;
  const isDegradedSeed =
    seedResult?.key === seedKey ? Boolean(seedResult.isDegraded) : false;

  const initialSeedRef = useRef<IBulkSendAddressesInputSeed | undefined>(seed);
  const initialSeed = initialSeedRef.current;
  const initialSender =
    initialMode === EBulkSendMode.OneToMany ? initialSeed?.sender : undefined;

  const form = useForm<IBulkSendAddressesFormValues>({
    defaultValues: {
      senderAddresses: initialSender?.address ?? '',
      receiverAddresses: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const [selectedAccountId, setSelectedAccountId] = useState<
    string | undefined
  >(initialSeed?.accountId);
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(initialSeed?.networkId);
  const [selectedToken, setSelectedToken] = useState<IToken | undefined>(
    initialSeed?.token,
  );
  const [selectedIndexedAccountId, setSelectedIndexedAccountId] = useState<
    string | undefined
  >(initialSeed?.indexedAccountId);
  const [appliedSeed, setAppliedSeed] = useState<IAppliedSeed | undefined>(
    initialSeed ? { key: seedKey, seed: initialSeed } : undefined,
  );
  const [seededNetwork, setSeededNetwork] = useState<
    IBulkSendAddressesInputSeedNetwork | undefined
  >(initialSeed?.network);
  const [seededSender, setSeededSender] = useState<
    IBulkSendAddressesInputSeedSender | undefined
  >(initialSender);

  const [selectedTokenDetail, setSelectedTokenDetail] = useState<
    ({ info: IToken } & ITokenFiat) | undefined
  >(undefined);

  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: initialMode !== EBulkSendMode.OneToMany,
    isRefreshing: initialMode === EBulkSendMode.OneToMany,
  });
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
  const [isSenderFieldMounted, setIsSenderFieldMounted] = useState(false);

  const isInitializing = appliedSeed?.key !== seedKey;

  useEffect(() => {
    const plan = resolveBulkSendSeedApplyPlan({
      seed,
      seedKey,
      appliedSeed,
      selectedAccountId,
      selectedNetworkId,
      hasUserSelectedAsset,
      isDegradedSeed,
    });
    if (plan.action === 'skip' || !seed) {
      return;
    }
    if (plan.action === 'record') {
      // The user already moved to another sender / network on the page, or
      // this seed is degraded: remember it so it is not re-evaluated, but
      // leave the selection and the sender field alone.
      setAppliedSeed({ key: seedKey, seed });
      return;
    }
    const sender =
      bulkSendMode === EBulkSendMode.OneToMany ? seed.sender : undefined;
    // Everything lands in one commit: the token, the network and the
    // sender address paint together instead of in stages.
    setSelectedAccountId(seed.accountId);
    setSelectedNetworkId(seed.networkId);
    if (!plan.keepUserToken) {
      setSelectedToken(seed.token);
      setHasUserSelectedAsset(false);
    }
    setSelectedIndexedAccountId(seed.indexedAccountId);
    setSeededNetwork(seed.network);
    setSeededSender(sender);
    if (bulkSendMode === EBulkSendMode.OneToMany) {
      form.setValue('senderAddresses', sender?.address ?? '');
      if (sender?.address) {
        void form.trigger('senderAddresses');
      }
    }
    setAppliedSeed({ key: seedKey, seed });
  }, [
    appliedSeed,
    bulkSendMode,
    form,
    hasUserSelectedAsset,
    isDegradedSeed,
    seed,
    seedKey,
    selectedAccountId,
    selectedNetworkId,
  ]);

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
      isInitializing,
      seededAccountId: appliedSeed?.seed.accountId,
      seededNetworkId: appliedSeed?.seed.networkId,
      seededNetwork,
      seededSender,
      isSenderFieldMounted,
      setIsSenderFieldMounted,
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
      isInitializing,
      appliedSeed,
      seededNetwork,
      seededSender,
      isSenderFieldMounted,
    ],
  );

  return (
    <BulkSendAddressesInputContext.Provider value={context}>
      <BaseBulkSendAddressesInput form={form} />
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
