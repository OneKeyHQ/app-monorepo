import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  NativeList,
  type NativeListActionAnchor,
  type NativeListProps,
  type NativeListRef,
  type NativeListSnapshot,
  type RowModel,
} from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  SizableText,
  Stack,
  Toast,
  resetAccountManagerStacksModal,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import qrHiddenCreateGuideDialog from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { accountSelectorAccountsListIsLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { HiddenWalletRememberSwitch } from '../../../components/WalletEdit/HiddenWalletRememberSwitch';
import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';
import { AccountManagerTestIDs } from '../../../testIDs';
import { useAccountSelectorNativeListThemeV2 } from '../accountSelectorNativeListV2';

import {
  type IAccountSelectorRowRecordV2,
  buildAccountSelectorRowPatchesV2,
  useAccountSelectorAccountRowsV2,
} from './accountSelectorAccountRowsV2';
import {
  AccountSelectorCreateAddressActionV2,
  AccountSelectorMenuActionV2,
} from './AccountSelectorActionV2';
import { EmptyView } from './EmptyView';
import { useAddAccount } from './hooks/useAddAccount';
import { useAccountSelectorValuesLoader } from './useAccountSelectorValuesLoader';
import { WalletDetailsHeader } from './WalletDetailsHeader';
import { AccountSearchBar } from './WalletDetailsHeader/AccountSearchBar';

import type { IAccountEditActionListV2Props } from './AccountEditActionListV2';

export interface IWalletDetailsProps {
  num: number;
  wallet?: IDBWallet;
  device?: IDBDevice | undefined;
}

function BotWalletDeactivatedBanner({ walletId }: { walletId: string }) {
  const { result: isBotWalletDeactivated } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceAccount.isBotWalletDeactivated({ walletId }),
    [walletId],
    {
      checkIsFocused: false,
    },
  );

  if (!isBotWalletDeactivated) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type="warning"
      title="该 Bot 钱包已停用"
      description="收款功能已禁用。如需转移资产，请使用发送功能。"
    />
  );
}

function WalletDetailsViewV2({ num }: IWalletDetailsProps) {
  const intl = useIntl();
  const { serviceAccountSelector } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const listRef = useRef<NativeListRef | null>(null);
  const route = useAccountSelectorRoute();
  const selectedAccountRef =
    useRef<IAccountSelectorSelectedAccount>(selectedAccount);
  selectedAccountRef.current = selectedAccount;

  const linkNetwork: boolean | undefined = route.params?.linkNetwork;
  const linkNetworkId: string | undefined = route.params?.linkNetworkId;
  const linkNetworkDeriveType: IAccountDeriveTypes | undefined =
    route.params?.linkNetworkDeriveType;

  const isEditableRouteParams = route.params?.editable;
  const keepAllOtherAccounts = route.params?.keepAllOtherAccounts;
  const allowSelectEmptyAccount = route.params?.allowSelectEmptyAccount;
  const hideAddress = route.params?.hideAddress;
  const linkedNetworkId = useMemo(() => {
    if (linkNetworkId) {
      return linkNetworkId;
    }
    return linkNetwork ? selectedAccount?.networkId : undefined;
  }, [linkNetworkId, linkNetwork, selectedAccount?.networkId]);
  const usedDeriveType = useMemo(() => {
    if (linkNetworkId && linkNetworkDeriveType) {
      return linkNetworkDeriveType;
    }
    return selectedAccount?.deriveType;
  }, [linkNetworkId, linkNetworkDeriveType, selectedAccount?.deriveType]);
  const selectedNetworkId = selectedAccount?.networkId;
  const [searchText, setSearchText] = useState('');
  const { createQrWallet } = useCreateQrWallet();
  const [storageReady] = useAccountSelectorStorageReadyAtom();

  const accountsListSwrKey = useMemo(() => {
    if (!selectedAccount?.focusedWallet || !usedDeriveType) return undefined;
    return swrKeys.accountSelectorList({
      focusedWallet: selectedAccount.focusedWallet,
      deriveType: usedDeriveType,
      linkedNetworkId,
      selectedNetworkId,
      keepAllOtherAccounts,
    });
  }, [
    selectedAccount?.focusedWallet,
    usedDeriveType,
    linkedNetworkId,
    selectedNetworkId,
    keepAllOtherAccounts,
  ]);

  defaultLogger.accountSelector.perf.renderAccountsList({
    selectedAccount,
  });

  // TODO move to hooks
  const isOthers = selectedAccount?.focusedWallet === '$$others';
  const isOthersWallet = Boolean(
    selectedAccount?.focusedWallet &&
    accountUtils.isOthersWallet({
      walletId: selectedAccount?.focusedWallet,
    }),
  );
  const isOthersUniversal = isOthers || isOthersWallet;
  // const isOthersUniversal = true;

  const {
    result: listDataResult,
    run: reloadAccounts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setResult: _setListDataResult,
  } = usePromiseResult(
    async () => {
      if (!selectedAccount?.focusedWallet || !usedDeriveType) {
        defaultLogger.accountSelector.listData.listDataMissingParams({
          focusedWallet: selectedAccount?.focusedWallet,
          deriveType: usedDeriveType,
          selectedAccount: selectedAccountRef.current,
        });
        return Promise.resolve(undefined);
      }

      // await timerUtils.wait(1000);
      const accountSelectorAccountsListData =
        await serviceAccountSelector.buildAccountSelectorAccountsListData({
          focusedWallet: selectedAccount?.focusedWallet,
          linkedNetworkId,
          selectedNetworkId,
          deriveType: usedDeriveType,
          othersNetworkId: selectedAccount?.networkId,
          keepAllOtherAccounts,
        });

      return accountSelectorAccountsListData;
    },
    [
      keepAllOtherAccounts,
      linkedNetworkId,
      selectedNetworkId,
      usedDeriveType,
      selectedAccount?.focusedWallet,
      selectedAccount?.networkId,
      serviceAccountSelector,
    ],
    {
      // debounced: 100,
      checkIsFocused: false,
      watchLoading: false,
      swrKey: accountsListSwrKey,
      onIsLoadingChange(loading) {
        // setIsLoading(loading);
        void accountSelectorAccountsListIsLoadingAtom.set(loading);
      },
    },
  );

  // Drives EmptyView's skeleton-vs-no-wallet decision. We're "resolved" when
  // either: (a) we already have a result (real fetch or SWR cache hit), or
  // (b) storage finished hydrating and confirmed there's no focused wallet
  // — i.e. the user truly has none. The early-return path inside the
  // usePromiseResult method also resolves to undefined, so without (b) the
  // genuine "no wallets" case would render an infinite skeleton.
  const hasResolved = useMemo(() => {
    if (listDataResult !== undefined) return true;
    if (storageReady && !selectedAccount?.focusedWallet) return true;
    return false;
  }, [listDataResult, storageReady, selectedAccount?.focusedWallet]);

  const sectionDataOriginal = useMemo(
    () => listDataResult?.sectionData || [],
    [listDataResult?.sectionData],
  );
  const indexedAccountIdsKey = useMemo(
    () => sectionDataOriginal.flatMap((s) => s.data.map((item) => item.id)),
    [sectionDataOriginal],
  );
  // Stabilize reference — only produce a new array when content changes
  const indexedAccountIds = useMemo(
    () => indexedAccountIdsKey,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indexedAccountIdsKey.join(',')],
  );

  // Lazy-load address map only when searching (avoids DB read on every wallet/network switch)
  const isSearching = !!searchText;
  const { result: accountAddressMap } = usePromiseResult(
    async () => {
      if (!isSearching || linkedNetworkId) return undefined;
      if (!selectedAccount?.focusedWallet || !indexedAccountIds.length) {
        return undefined;
      }
      return serviceAccountSelector.buildAccountAddressMap({
        focusedWallet: selectedAccount.focusedWallet,
        indexedAccountIds,
      });
    },
    [
      isSearching,
      linkedNetworkId,
      selectedAccount?.focusedWallet,
      indexedAccountIds,
      serviceAccountSelector,
    ],
    {
      checkIsFocused: false,
    },
  );
  // When address map is expected but not yet loaded, hold off filtering to avoid "no result" flash
  const isIndexedAccountWallet = accountUtils.isIndexedAccountWallet({
    walletId: selectedAccount?.focusedWallet,
  });
  const addressMapLoading =
    isSearching &&
    !linkedNetworkId &&
    isIndexedAccountWallet &&
    accountAddressMap === undefined;

  const sectionData = useMemo(() => {
    if (!searchText || addressMapLoading) {
      return sectionDataOriginal;
    }
    const query = searchText.toLowerCase();
    const sectionDataFiltered: IAccountSelectorAccountsListSectionData[] = [];
    sectionDataOriginal.forEach((section) => {
      const { data, ...others } = section;
      sectionDataFiltered.push({
        ...others,
        data:
          (data as IDBIndexedAccount[])?.filter((item) => {
            if (item.name?.toLowerCase().includes(query)) {
              return true;
            }
            // Prefer inline address when available (set by linked-network queries)
            const address =
              (item as unknown as IDBAccount).address ||
              item.associateAccount?.address ||
              '';
            if (address.toLowerCase().includes(query)) {
              return true;
            }
            // Fallback: pre-lowercased addresses from All Network map
            const addresses = accountAddressMap?.[item.id];
            if (addresses?.some((addr) => addr.includes(query))) {
              return true;
            }
            return false;
          }) ?? [],
      });
    });
    return sectionDataFiltered;
  }, [sectionDataOriginal, searchText, accountAddressMap, addressMapLoading]);

  // Load account values asynchronously in batches via atoms, scoped by selector num
  useAccountSelectorValuesLoader({
    num,
    accountsForValuesQuery: listDataResult?.accountsForValuesQuery,
    linkedNetworkId,
  });

  const accountsCount = useMemo(
    () => listDataResult?.accountsCount ?? 0,
    [listDataResult?.accountsCount],
  );
  const focusedWalletInfo = useMemo(
    () => listDataResult?.focusedWalletInfo,
    [listDataResult?.focusedWalletInfo],
  );

  const isDeprecatedWallet = useMemo(
    () => focusedWalletInfo?.wallet?.deprecated,
    [focusedWalletInfo?.wallet?.deprecated],
  );

  const { enabledNetworksCompatibleWithWalletId, networkInfoMap } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: focusedWalletInfo?.wallet?.id ?? '',
      networkId: selectedNetworkId,
      withNetworksInfo: true,
    });

  useEffect(() => {
    const fn = async () => {
      await reloadAccounts();
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [reloadAccounts]);

  const { bottom, top } = useSafeAreaInsets();
  const theme = useAccountSelectorNativeListThemeV2();
  const appTheme = useTheme();
  const editable = !!isEditableRouteParams && sectionData.length > 0;
  const isMockedStandardHwWallet = focusedWalletInfo?.wallet?.isMocked;
  const isHiddenWallet = !!focusedWalletInfo?.wallet?.passphraseState;
  const title = isOthers ? 'Others' : focusedWalletInfo?.wallet?.name || '';
  const [listHeight, setListHeight] = useState(0);
  const [pendingMenu, setPendingMenu] = useState<{
    anchor: NativeListActionAnchor;
    account: IAccountEditActionListV2Props;
  }>();
  const [pendingCreate, setPendingCreate] = useState<{
    record: IAccountSelectorRowRecordV2;
    walletId: string;
    networkId?: string;
    deriveType?: IAccountDeriveTypes;
  }>();
  const creatingRef = useRef(false);
  const { handleAddAccount } = useAddAccount({
    num,
    isOthersUniversal,
    focusedWalletInfo,
  });
  const { rows: accountRows, records } = useAccountSelectorAccountRowsV2({
    num,
    sections: sectionData,
    selectedAccount,
    wallet: focusedWalletInfo?.wallet,
    linkedNetworkId,
    linkNetwork,
    isOthersUniversal,
    hideAddress,
    allowSelectEmptyAccount,
    editable,
    mergeDeriveAssetsEnabled: listDataResult?.mergeDeriveAssetsEnabled,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    theme,
  });
  const listIdentity = `${focusedWalletInfo?.wallet?.id ?? ''}:${linkedNetworkId ?? ''}:${usedDeriveType ?? ''}:${searchText}`;
  const identityRef = useRef(listIdentity);
  const generationRef = useRef(1);
  if (identityRef.current !== listIdentity) {
    identityRef.current = listIdentity;
    generationRef.current += 1;
  }
  const generation = generationRef.current;
  const snapshot = useMemo<NativeListSnapshot>(() => {
    const rows: RowModel[] = [];
    if (isDeprecatedWallet) {
      rows.push({
        type: 'system',
        variant: 'warning',
        key: 'deprecated-wallet',
        title: intl.formatMessage({
          id: ETranslations.wallet_wallet_device_has_been_reset_alert_title,
        }),
        message: intl.formatMessage({
          id: ETranslations.wallet_wallet_device_has_been_reset_alert_desc,
        }),
        backgroundColor: appTheme.bgCautionSubdued.val,
        borderColor: appTheme.borderCautionSubdued.val,
        backgroundFullWidth: true,
      });
    }
    const byId = new Map(accountRows.map((row) => [row.key, row]));
    sectionData.forEach((section, sectionIndex) => {
      if (!section.data.length && section.emptyText) {
        rows.push({
          type: 'action',
          key: `empty:${sectionIndex}`,
          presentation: 'accountSelector',
          tone: 'primary',
          title: section.emptyText,
          actionKey: 'empty',
          pressDisabled: true,
          height: 56,
        });
      }
      section.data.forEach((item) => {
        const row = byId.get(item.id);
        if (row) rows.push(row);
      });
      if (
        isEditableRouteParams &&
        !searchText &&
        focusedWalletInfo?.wallet?.id &&
        !isMockedStandardHwWallet &&
        sectionDataOriginal.length
      ) {
        rows.push({
          type: 'action',
          key: `add-account:${sectionIndex}`,
          testID: AccountManagerTestIDs.accountAddAccount,
          presentation: 'accountSelector',
          title: intl.formatMessage({
            id: platformEnv.isWebDappMode
              ? ETranslations.onboarding_connect_external_wallet
              : ETranslations.global_add_account,
          }),
          actionKey: 'add-account',
          icon: {
            kind: 'icon',
            name: 'PlusSmallOutline',
            backgroundColor: theme.strongBackground,
            tintColor: theme.icon,
          },
          height: 48,
        });
      }
    });
    return {
      schemaVersion: 1,
      generation,
      theme,
      layout: {
        kind: 'linear',
        contentPaddingHorizontal: 8,
        contentPaddingBottom: 12,
        itemSpacing: 0,
      },
      rows,
    };
  }, [
    appTheme,
    isDeprecatedWallet,
    accountRows,
    sectionData,
    isEditableRouteParams,
    searchText,
    focusedWalletInfo?.wallet?.id,
    isMockedStandardHwWallet,
    sectionDataOriginal.length,
    intl,
    generation,
    theme,
  ]);
  // Keep the native snapshot prop stable while balance batches update row fields.
  const [nativeSnapshot, setNativeSnapshot] = useState(snapshot);
  const appliedSnapshotRef = useRef<
    { base: NativeListSnapshot; latest: NativeListSnapshot } | undefined
  >(undefined);
  if (
    buildAccountSelectorRowPatchesV2(nativeSnapshot, snapshot) === undefined
  ) {
    setNativeSnapshot(snapshot);
  }
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      appliedSnapshotRef.current = undefined;
      return;
    }
    const previous =
      appliedSnapshotRef.current?.base === nativeSnapshot
        ? appliedSnapshotRef.current.latest
        : nativeSnapshot;
    const patches = buildAccountSelectorRowPatchesV2(previous, snapshot);
    if (patches?.length) list.applyPatches(patches);
    appliedSnapshotRef.current = { base: nativeSnapshot, latest: snapshot };
  }, [nativeSnapshot, snapshot, listHeight]);
  const selectedKey = isOthersUniversal
    ? selectedAccount.othersWalletAccountId
    : selectedAccount.indexedAccountId;
  const selectedIndex = records.findIndex(
    (record) => record.key === selectedKey,
  );
  const initialScrollKey =
    !searchText && listHeight > 0 && selectedIndex * 60 > listHeight
      ? selectedKey
      : undefined;
  const closeMenu = useCallback(
    (token: string) =>
      setPendingMenu((current) =>
        current?.anchor.token === token ? undefined : current,
      ),
    [],
  );
  const finishCreate = useCallback(() => {
    creatingRef.current = false;
    setPendingCreate(undefined);
  }, []);
  useEffect(() => {
    setPendingMenu(undefined);
  }, [listIdentity]);

  const handleAccountPress = useCallback(
    async (record: IAccountSelectorRowRecordV2) => {
      if (
        record.isCreatingAddress ||
        (!allowSelectEmptyAccount && record.shouldShowCreateAddressButton)
      )
        return;
      if (isOthersUniversal) {
        let autoChangeToAccountMatchedNetworkId = record.avatarNetworkId;
        if (
          selectedAccount.networkId &&
          networkUtils.isAllNetwork({ networkId: selectedAccount.networkId })
        )
          autoChangeToAccountMatchedNetworkId = selectedAccount.networkId;
        const confirmed = await actions.current.confirmAccountSelect({
          num,
          indexedAccount: undefined,
          othersWalletAccount: record.account,
          autoChangeToAccountMatchedNetworkId,
        });
        if (!confirmed) return;
      } else if (focusedWalletInfo) {
        const confirmed = await actions.current.confirmAccountSelect({
          num,
          indexedAccount: record.indexedAccount,
          othersWalletAccount: undefined,
          autoChangeToAccountMatchedNetworkId: undefined,
        });
        if (!confirmed) return;
      }
      resetAccountManagerStacksModal();
    },
    [
      actions,
      allowSelectEmptyAccount,
      focusedWalletInfo,
      isOthersUniversal,
      num,
      selectedAccount.networkId,
    ],
  );

  const deprecatedAlert = isDeprecatedWallet ? (
    <Alert
      fullBleed
      type="warning"
      title={intl.formatMessage({
        id: ETranslations.wallet_wallet_device_has_been_reset_alert_title,
      })}
      description={intl.formatMessage({
        id: ETranslations.wallet_wallet_device_has_been_reset_alert_desc,
      })}
    />
  ) : null;

  const nativeListProps: Omit<
    NativeListProps,
    | 'initialScrollIndex'
    | 'initialScrollKey'
    | 'initialScrollViewPosition'
    | 'initialScrollViewOffset'
  > = {
    style: { flex: 1 },
    testID: 'account-selector-account-list-v2',
    snapshot: nativeSnapshot,
    onActionAnchorInvalidated: (event) => closeMenu(event.token),
    onRowAction: (event) => {
      if (event.actionKey === 'add-account') {
        void handleAddAccount();
        return;
      }
      const record = records.find(
        (candidate) => candidate.key === event.rowKey,
      );
      if (!record) return;
      if (
        event.actionKey === 'account-more' &&
        event.anchor &&
        editable &&
        !record.isCreatingAddress &&
        !record.shouldShowCreateAddressButton
      ) {
        setPendingMenu({
          anchor: event.anchor,
          account: {
            avatarNetworkId: record.avatarNetworkId,
            accountsCount,
            indexedAccount: record.indexedAccount,
            firstIndexedAccount: isOthersUniversal
              ? undefined
              : (record.section.firstAccount as IDBIndexedAccount),
            account: record.account,
            firstAccount: isOthersUniversal
              ? (record.section.firstAccount as IDBAccount)
              : undefined,
            wallet: focusedWalletInfo?.wallet,
            networkId: linkedNetworkId ?? selectedNetworkId,
          },
        });
      } else if (
        event.actionKey === 'create-address' &&
        record.shouldShowCreateAddressButton &&
        !record.isCreatingAddress &&
        !creatingRef.current &&
        focusedWalletInfo?.wallet?.id
      ) {
        creatingRef.current = true;
        setPendingCreate({
          record,
          walletId: focusedWalletInfo.wallet.id,
          networkId: linkedNetworkId,
          deriveType: selectedAccount.deriveType,
        });
      } else if (event.actionKey === 'press') {
        void handleAccountPress(record);
      }
    },
  };
  const accountList = initialScrollKey ? (
    <NativeList
      key={listIdentity}
      ref={listRef}
      {...nativeListProps}
      initialScrollKey={initialScrollKey}
    />
  ) : (
    <NativeList key={listIdentity} ref={listRef} {...nativeListProps} />
  );

  return (
    <>
      <Stack
        key={focusedWalletInfo?.wallet?.id}
        flex={1}
        pt={platformEnv.isNativeAndroid ? top : undefined}
        pb={Math.max(bottom, 8)}
        testID={AccountManagerTestIDs.accountList}
      >
        <WalletDetailsHeader
          wallet={focusedWalletInfo?.wallet}
          device={focusedWalletInfo?.device}
          editable={editable}
          linkedNetworkId={linkedNetworkId}
          num={num}
          title={title}
        />
        {focusedWalletInfo?.wallet?.id &&
        accountUtils.isBotWallet({ walletId: focusedWalletInfo.wallet.id }) ? (
          <BotWalletDeactivatedBanner walletId={focusedWalletInfo.wallet.id} />
        ) : null}
        {platformEnv.isWebDappMode &&
        accountUtils.isHwWallet({ walletId: focusedWalletInfo?.wallet?.id }) ? (
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.global_web_access_for_hardware_wallet_disconnected,
            })}
            mx="$5"
            mb="$2"
          />
        ) : null}
        {focusedWalletInfo?.wallet?.id && isHiddenWallet && editable ? (
          <HiddenWalletRememberSwitch wallet={focusedWalletInfo.wallet} />
        ) : null}
        {!platformEnv.isWebDappMode &&
        !isMockedStandardHwWallet &&
        sectionDataOriginal.length &&
        focusedWalletInfo?.wallet?.id ? (
          <AccountSearchBar
            searchText={searchText}
            onSearchTextChange={setSearchText}
            num={num}
            isOthersUniversal={isOthersUniversal}
            focusedWalletInfo={focusedWalletInfo}
            editable={editable}
            currentNetworkId={linkedNetworkId}
          />
        ) : null}
        {isMockedStandardHwWallet ? deprecatedAlert : null}
        {isMockedStandardHwWallet ? (
          <Stack flex={1} justifyContent="center" alignItems="center">
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: ETranslations.no_standard_wallet_desc,
              })}
            </SizableText>
            {isEditableRouteParams ? (
              <Button
                testID="account-manager-btn"
                mt="$6"
                icon="PlusLargeOutline"
                disabled={isDeprecatedWallet}
                onPress={async () => {
                  if (
                    accountUtils.isQrWallet({
                      walletId: focusedWalletInfo.wallet?.id,
                    })
                  ) {
                    qrHiddenCreateGuideDialog.showDialogForCreatingStandardWallet(
                      {
                        onConfirm: () => {
                          void createQrWallet({ isOnboarding: true });
                        },
                      },
                    );
                    return;
                  }
                  if (!focusedWalletInfo?.device?.featuresInfo) {
                    Toast.error({
                      title: 'Error',
                      message: 'No device features found',
                    });
                    return;
                  }
                  await actions.current.createHWWalletWithoutHidden({
                    device: focusedWalletInfo.device,
                    features: focusedWalletInfo.device.featuresInfo,
                  });
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.global_standard_wallet,
                })}
              </Button>
            ) : null}
          </Stack>
        ) : null}
        {!isMockedStandardHwWallet && !sectionData.length ? (
          <EmptyView hasResolved={hasResolved} />
        ) : null}
        {!isMockedStandardHwWallet && sectionData.length ? (
          <Stack
            flex={1}
            onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
          >
            {listHeight > 0 ? accountList : null}
          </Stack>
        ) : null}
      </Stack>
      {pendingMenu ? (
        <AccountSelectorMenuActionV2
          key={pendingMenu.anchor.token}
          anchor={pendingMenu.anchor}
          listRef={listRef}
          onClose={closeMenu}
          account={pendingMenu.account}
        />
      ) : null}
      {pendingCreate ? (
        <AccountSelectorCreateAddressActionV2
          key={pendingCreate.record.key}
          num={num}
          walletId={pendingCreate.walletId}
          networkId={pendingCreate.networkId}
          indexedAccountId={pendingCreate.record.indexedAccount?.id}
          deriveType={pendingCreate.deriveType}
          onDone={finishCreate}
        />
      ) : null}
    </>
  );
}

export const WalletDetailsV2 = memo(WalletDetailsViewV2);
