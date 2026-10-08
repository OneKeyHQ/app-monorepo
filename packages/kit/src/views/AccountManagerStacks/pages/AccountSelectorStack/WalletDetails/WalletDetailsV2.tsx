import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ImageSource,
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
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS,
  buildAccountSelectorRowPrewarmParams,
  prewarmHomeTokenListOwner,
  prewarmHomeTokenListOwnerWithin,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/prewarmOwnerFrames';
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
import {
  accountSelectorAccountsListIsLoadingAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HiddenWalletRememberSwitch } from '../../../components/WalletEdit/HiddenWalletRememberSwitch';
import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';
import { AccountManagerTestIDs } from '../../../testIDs';
import { useAccountSelectorNativeListThemeV2 } from '../accountSelectorNativeListV2';

import {
  type IAccountSelectorRowRecordV2,
  useAccountSelectorAccountRowsV2,
  useAccountSelectorNativeSnapshotV2,
} from './accountSelectorAccountRowsV2';
import {
  AccountSelectorCreateAddressActionV2,
  AccountSelectorMenuActionV2,
} from './AccountSelectorActionV2';
import { preloadAccountSelectorAvatarImages } from './accountSelectorAvatarPreload';
import { buildAccountSelectorValueDisplayScopeKeyV2 } from './accountSelectorValueDisplayCacheV2';
import { DeprecatedWalletBanner } from './DeprecatedWalletBanner';
import { EmptyNoAccountsView, EmptyView } from './EmptyView';
import { useAddAccount } from './hooks/useAddAccount';
import { useAccountSelectorValuesLoaderV2 } from './useAccountSelectorValuesLoaderV2';
import { WalletDetailsHeader } from './WalletDetailsHeader';
import { AccountSearchBar } from './WalletDetailsHeader/AccountSearchBar';

import type { IAccountEditActionListV2Props } from './AccountEditActionListV2';

const INITIAL_ACCOUNT_IMAGE_PRELOAD_COUNT = 16;
const ACCOUNT_IMAGE_PRELOAD_BUDGET_MS = 200;
// Longest a switched wallet waits for its avatars and first-screen balances
// before it is presented anyway.
const ACCOUNT_PRESENTATION_BUDGET_MS = 300;

async function preloadAccountSelectorImages(
  sources: readonly ImageSource[],
): Promise<void> {
  if (!sources.length) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    preloadAccountSelectorAvatarImages(sources).catch(() => false),
    new Promise<boolean>((resolve) => {
      timeout = setTimeout(
        () => resolve(false),
        ACCOUNT_IMAGE_PRELOAD_BUDGET_MS,
      );
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

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

// Accounts listed first are the likeliest targets; a wallet with more rows
// than this still prewarms the tapped row itself.
const HOME_TOKEN_LIST_PREWARM_MAX_ROWS = 12;

function WalletDetailsViewV2({ num }: IWalletDetailsProps) {
  const intl = useIntl();
  const [{ currencyInfo }] = useSettingsPersistAtom();
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
  const { sceneName } = useAccountSelectorSceneInfo();
  // Every scene (Swap, Send, DApp, ...) pushes this page, but only the home
  // selector switches the home token list the prewarm feeds.
  const canPrewarmHomeTokenList = sceneName === EAccountSelectorSceneName.home;

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
  // NativeList action titles are single-line, so empty-section messages are
  // rendered by React above the list where they can wrap.
  const emptySections = useMemo(
    () =>
      sectionData.filter(
        (section) => !section.data.length && !!section.emptyText,
      ),
    [sectionData],
  );

  // Load account values asynchronously in batches via atoms, scoped by selector num
  const { valuesLoaded } = useAccountSelectorValuesLoaderV2({
    num,
    accountsForValuesQuery: listDataResult?.accountsForValuesQuery,
    linkedNetworkId,
  });
  const valueDisplayCacheKey = useMemo(
    () =>
      selectedAccount?.focusedWallet
        ? swrKeys.accountSelectorValues({
            walletId: selectedAccount.focusedWallet,
          })
        : undefined,
    [selectedAccount?.focusedWallet],
  );
  const valueDisplayScopeKey = useMemo(
    () =>
      buildAccountSelectorValueDisplayScopeKeyV2({
        deriveType: usedDeriveType ?? '',
        linkedNetworkId,
        selectedNetworkId,
        keepAllOtherAccounts,
      }),
    [usedDeriveType, linkedNetworkId, selectedNetworkId, keepAllOtherAccounts],
  );

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

  const {
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    isReady: walletNetworksReady,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
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
  const { handleAddAccount, canAddAccount } = useAddAccount({
    num,
    isOthersUniversal,
    focusedWalletInfo,
  });
  const {
    rows: accountRows,
    records,
    areRowValuesReady,
  } = useAccountSelectorAccountRowsV2({
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
    walletNetworksReady,
    theme,
    valueDisplayCacheKey,
    valueDisplayScopeKey,
    persistDisplayedValues: !searchText,
    valuesLoaded,
  });

  // Prewarm the home token list for the listed accounts while the selector is
  // open (OK-63873): the tap then finds the owner's frames in the replay
  // cache and the switch paints without a skeleton. Sequential and bounded so
  // it stays a background courtesy; the tap itself re-requests its target.
  // Search results are a transient subset (not persisted either, see
  // `persistDisplayedValues`): targeting them restarted the batch on every
  // debounced keystroke and re-asked for owners that have no frames.
  const homeTokenListPrewarmTargets = useMemo(
    () =>
      canPrewarmHomeTokenList && !searchText
        ? records.slice(0, HOME_TOKEN_LIST_PREWARM_MAX_ROWS).map((record) =>
            buildAccountSelectorRowPrewarmParams({
              row: record,
              isOthersUniversal,
              selectedNetworkId: selectedAccount.networkId,
              selectedDeriveType: selectedAccount.deriveType,
              currencyId: currencyInfo.id,
            }),
          )
        : [],
    [
      canPrewarmHomeTokenList,
      currencyInfo.id,
      isOthersUniversal,
      records,
      searchText,
      selectedAccount.deriveType,
      selectedAccount.networkId,
    ],
  );
  const homeTokenListPrewarmTargetsRef = useRef(homeTokenListPrewarmTargets);
  homeTokenListPrewarmTargetsRef.current = homeTokenListPrewarmTargets;
  // Records are rebuilt on unrelated row state; restart only on new targets.
  const homeTokenListPrewarmTargetsKey = homeTokenListPrewarmTargets
    .map((params) =>
      [
        params.networkId,
        params.deriveType,
        params.indexedAccountId,
        params.othersWalletAccountId,
        params.currencyId,
      ].join(':'),
    )
    .join('|');
  useEffect(() => {
    const targets = homeTokenListPrewarmTargetsRef.current;
    if (!targets.length) {
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      for (const params of targets) {
        if (cancelled) {
          return;
        }
        await prewarmHomeTokenListOwner(params);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homeTokenListPrewarmTargetsKey]);
  const listIdentity = `${focusedWalletInfo?.wallet?.id ?? ''}:${linkedNetworkId ?? ''}:${usedDeriveType ?? ''}:${searchText}`;
  // Everything that changes the list or its balances, not only the wallet.
  const presentationScope = `${focusedWalletInfo?.wallet?.id ?? ''}:${valueDisplayScopeKey}`;
  const identityRef = useRef(listIdentity);
  const generationRef = useRef(1);
  if (identityRef.current !== listIdentity) {
    identityRef.current = listIdentity;
    generationRef.current += 1;
  }
  const generation = generationRef.current;
  const snapshot = useMemo<NativeListSnapshot>(() => {
    const rows: RowModel[] = [];
    const byId = new Map(accountRows.map((row) => [row.key, row]));
    sectionData.forEach((section, sectionIndex) => {
      section.data.forEach((item) => {
        const row = byId.get(item.id);
        if (row) rows.push(row);
      });
      if (
        isEditableRouteParams &&
        !searchText &&
        focusedWalletInfo?.wallet?.id &&
        canAddAccount &&
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
    canAddAccount,
    accountRows,
    sectionData,
    isEditableRouteParams,
    searchText,
    focusedWalletInfo?.wallet?.id,
    sectionDataOriginal.length,
    intl,
    generation,
    theme,
  ]);
  const selectedKey = isOthersUniversal
    ? selectedAccount.othersWalletAccountId
    : selectedAccount.indexedAccountId;
  const selectedIndex = records.findIndex(
    (record) => record.key === selectedKey,
  );
  const initialImagePreloadSources = useMemo(() => {
    if (
      (!platformEnv.isNative && !platformEnv.isDesktop) ||
      !accountRows.length
    ) {
      return [];
    }
    const start = Math.max(
      0,
      Math.min(
        selectedIndex < 0 ? 0 : selectedIndex,
        accountRows.length - INITIAL_ACCOUNT_IMAGE_PRELOAD_COUNT,
      ),
    );
    const sources: ImageSource[] = [];
    const sourceKeys = new Set<string>();
    const addSource = (source: ImageSource | undefined) => {
      if (!source) return;
      const key = [
        source.uri,
        source.width,
        source.height,
        source.contentFit ?? '',
        source.cachePolicy ?? '',
        source.optimizeTos ?? '',
      ].join(':');
      if (sourceKeys.has(key)) return;
      sourceKeys.add(key);
      sources.push(source);
    };
    accountRows
      .slice(start, start + INITIAL_ACCOUNT_IMAGE_PRELOAD_COUNT)
      .forEach((row) => {
        if (row.leading.kind !== 'account') return;
        addSource(row.leading.image);
        row.leading.overlays?.forEach((overlay) => addSource(overlay.image));
      });
    return sources;
  }, [accountRows, selectedIndex]);
  const initialImagePreloadScope = `${accountsListSwrKey ?? ''}:${initialImagePreloadSources
    .map((source) =>
      [source.uri, source.width, source.height, source.optimizeTos ?? ''].join(
        ':',
      ),
    )
    .join(',')}`;
  const initialImagePreloadSourcesRef = useRef(initialImagePreloadSources);
  initialImagePreloadSourcesRef.current = initialImagePreloadSources;
  const initialScrollKey =
    !searchText && listHeight > 0 && selectedIndex * 60 > listHeight
      ? selectedKey
      : undefined;
  // Rows the list shows first; the initial scroll brings the selected one in.
  const firstScreenValuesReady = areRowValuesReady(
    initialScrollKey
      ? Math.max(
          0,
          Math.min(
            selectedIndex,
            accountRows.length - INITIAL_ACCOUNT_IMAGE_PRELOAD_COUNT,
          ),
        )
      : 0,
    INITIAL_ACCOUNT_IMAGE_PRELOAD_COUNT,
  );
  const candidateList = useMemo(
    () => ({
      editable,
      emptySections,
      focusedWalletInfo,
      hasData: sectionData.length > 0,
      hasResolved,
      identity: listIdentity,
      presentationScope,
      initialScrollKey,
      isDeprecatedWallet,
      isHiddenWallet,
      isMockedStandardHwWallet,
      isOthersUniversal,
      linkedNetworkId,
      sectionDataOriginalLength: sectionDataOriginal.length,
      snapshot,
      title,
    }),
    [
      editable,
      emptySections,
      focusedWalletInfo,
      hasResolved,
      initialScrollKey,
      isDeprecatedWallet,
      isHiddenWallet,
      isMockedStandardHwWallet,
      isOthersUniversal,
      linkedNetworkId,
      listIdentity,
      presentationScope,
      sectionData.length,
      sectionDataOriginal.length,
      snapshot,
      title,
    ],
  );
  const [preloadedList, setPreloadedList] = useState(candidateList);
  const presentedList =
    candidateList.hasResolved &&
    candidateList.presentationScope === preloadedList.presentationScope
      ? candidateList
      : preloadedList;
  const candidateListRef = useRef(candidateList);
  candidateListRef.current = candidateList;
  useEffect(() => {
    if (
      candidateList.hasResolved &&
      candidateList.presentationScope === preloadedList.presentationScope
    ) {
      setPreloadedList(candidateList);
    }
  }, [candidateList, preloadedList.presentationScope]);
  // A new wallet/network/derive scope is presented once its avatars and
  // first-screen balances are ready (within one budget), so a switch paints
  // complete rows instead of placeholders that fill in afterwards.
  const pendingPresentationScope =
    candidateList.hasResolved &&
    candidateList.presentationScope !== preloadedList.presentationScope
      ? candidateList.presentationScope
      : undefined;
  const presentationWaitRef = useRef<{ scope?: string; id: number }>({
    id: 0,
  });
  if (presentationWaitRef.current.scope !== pendingPresentationScope) {
    presentationWaitRef.current = {
      scope: pendingPresentationScope,
      id: presentationWaitRef.current.id + 1,
    };
  }
  const presentationWaitId = presentationWaitRef.current.id;
  const [imagesReadyWaitId, setImagesReadyWaitId] = useState<number>();
  const [expiredWaitId, setExpiredWaitId] = useState<number>();
  useEffect(() => {
    if (!pendingPresentationScope) return;
    const timer = setTimeout(
      () => setExpiredWaitId(presentationWaitId),
      ACCOUNT_PRESENTATION_BUDGET_MS,
    );
    return () => clearTimeout(timer);
  }, [pendingPresentationScope, presentationWaitId]);
  useEffect(() => {
    if (!pendingPresentationScope) return;
    let cancelled = false;
    void preloadAccountSelectorImages(
      initialImagePreloadSourcesRef.current,
    ).then(() => {
      if (!cancelled) setImagesReadyWaitId(presentationWaitId);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingPresentationScope, presentationWaitId, initialImagePreloadScope]);
  useEffect(() => {
    if (!pendingPresentationScope) return;
    const ready =
      expiredWaitId === presentationWaitId ||
      (imagesReadyWaitId === presentationWaitId && firstScreenValuesReady);
    const latestCandidate = candidateListRef.current;
    if (
      ready &&
      latestCandidate.hasResolved &&
      latestCandidate.presentationScope === pendingPresentationScope
    ) {
      setPreloadedList(latestCandidate);
    }
  }, [
    expiredWaitId,
    firstScreenValuesReady,
    imagesReadyWaitId,
    pendingPresentationScope,
    presentationWaitId,
  ]);
  const nativeSnapshot = useAccountSelectorNativeSnapshotV2({
    identity: presentedList.identity,
    snapshot: presentedList.snapshot,
    listRef,
    listHeight,
  });
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

  // Give the home token list the owner's local-cache frames before the
  // publish so the switch paints without a skeleton (OK-63873); bounded so
  // the selection never waits on it, and skipped outside the home scene.
  const prewarmHomeTokenListBeforeSelect = useCallback(
    async (record: IAccountSelectorRowRecordV2) => {
      if (!canPrewarmHomeTokenList) {
        return;
      }
      await prewarmHomeTokenListOwnerWithin(
        buildAccountSelectorRowPrewarmParams({
          row: record,
          isOthersUniversal,
          selectedNetworkId: selectedAccount.networkId,
          selectedDeriveType: selectedAccount.deriveType,
          currencyId: currencyInfo.id,
        }),
        HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS,
      );
    },
    [
      canPrewarmHomeTokenList,
      currencyInfo.id,
      isOthersUniversal,
      selectedAccount.deriveType,
      selectedAccount.networkId,
    ],
  );

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
        await prewarmHomeTokenListBeforeSelect(record);
        const confirmed = await actions.current.confirmAccountSelect({
          num,
          indexedAccount: undefined,
          othersWalletAccount: record.account,
          autoChangeToAccountMatchedNetworkId,
        });
        if (!confirmed) return;
      } else if (focusedWalletInfo) {
        await prewarmHomeTokenListBeforeSelect(record);
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
      prewarmHomeTokenListBeforeSelect,
      selectedAccount.networkId,
    ],
  );

  const nativeListProps: Omit<
    NativeListProps,
    | 'initialScrollIndex'
    | 'initialScrollKey'
    | 'initialScrollViewPosition'
    | 'initialScrollViewOffset'
  > = {
    style: { flex: 1 },
    pointerEvents: presentedList.identity === listIdentity ? 'auto' : 'none',
    testID: 'account-selector-account-list-v2',
    keyboardDismissMode: 'on-drag',
    keyboardShouldPersistTaps: 'handled',
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
  const accountList = presentedList.initialScrollKey ? (
    <NativeList
      key={presentedList.identity}
      ref={listRef}
      {...nativeListProps}
      initialScrollKey={presentedList.initialScrollKey}
    />
  ) : (
    <NativeList
      key={presentedList.identity}
      ref={listRef}
      {...nativeListProps}
    />
  );

  return (
    <>
      <Stack
        flex={1}
        pt={platformEnv.isNativeAndroid ? top : undefined}
        pb={Math.max(bottom, 8)}
        testID={AccountManagerTestIDs.accountList}
      >
        <WalletDetailsHeader
          wallet={presentedList.focusedWalletInfo?.wallet}
          device={presentedList.focusedWalletInfo?.device}
          editable={presentedList.editable}
          linkedNetworkId={presentedList.linkedNetworkId}
          num={num}
          title={presentedList.title}
        />
        {presentedList.focusedWalletInfo?.wallet?.id &&
        accountUtils.isBotWallet({
          walletId: presentedList.focusedWalletInfo.wallet.id,
        }) ? (
          <BotWalletDeactivatedBanner
            walletId={presentedList.focusedWalletInfo.wallet.id}
          />
        ) : null}
        {platformEnv.isWebDappMode &&
        accountUtils.isHwWallet({
          walletId: presentedList.focusedWalletInfo?.wallet?.id,
        }) ? (
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.global_web_access_for_hardware_wallet_disconnected,
            })}
            mx="$5"
            mb="$2"
          />
        ) : null}
        {presentedList.focusedWalletInfo?.wallet?.id &&
        presentedList.isHiddenWallet &&
        presentedList.editable ? (
          <HiddenWalletRememberSwitch
            wallet={presentedList.focusedWalletInfo.wallet}
          />
        ) : null}
        {!platformEnv.isWebDappMode &&
        !presentedList.isMockedStandardHwWallet &&
        presentedList.sectionDataOriginalLength &&
        presentedList.focusedWalletInfo?.wallet?.id ? (
          <AccountSearchBar
            searchText={searchText}
            onSearchTextChange={setSearchText}
            num={num}
            isOthersUniversal={presentedList.isOthersUniversal}
            focusedWalletInfo={presentedList.focusedWalletInfo}
            editable={presentedList.editable}
            currentNetworkId={presentedList.linkedNetworkId}
          />
        ) : null}
        {/* Kept outside the list so it stays in place while accounts scroll. */}
        {presentedList.isDeprecatedWallet &&
        presentedList.focusedWalletInfo?.wallet ? (
          <DeprecatedWalletBanner
            // Remount per wallet so a previous wallet's lookup never shows.
            key={presentedList.focusedWalletInfo.wallet.id}
            num={num}
            wallet={presentedList.focusedWalletInfo.wallet}
            device={presentedList.focusedWalletInfo.device}
            editable={!!isEditableRouteParams}
          />
        ) : null}
        {presentedList.isMockedStandardHwWallet ? (
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
                disabled={presentedList.isDeprecatedWallet}
                onPress={async () => {
                  if (
                    accountUtils.isQrWallet({
                      walletId: presentedList.focusedWalletInfo?.wallet?.id,
                    })
                  ) {
                    qrHiddenCreateGuideDialog.showDialogForCreatingStandardWallet(
                      {
                        nativeSheet: true,
                        onConfirm: () => {
                          void createQrWallet({ isOnboarding: true });
                        },
                      },
                    );
                    return;
                  }
                  if (!presentedList.focusedWalletInfo?.device?.featuresInfo) {
                    Toast.error({
                      title: 'Error',
                      message: 'No device features found',
                    });
                    return;
                  }
                  await actions.current.createHWWalletWithoutHidden({
                    device: presentedList.focusedWalletInfo.device,
                    features:
                      presentedList.focusedWalletInfo.device.featuresInfo,
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
        {!presentedList.isMockedStandardHwWallet
          ? presentedList.emptySections.map((section) => (
              <EmptyNoAccountsView key={section.walletId} section={section} />
            ))
          : null}
        <Stack
          display={presentedList.isMockedStandardHwWallet ? 'none' : 'flex'}
          flex={1}
          position="relative"
          onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
        >
          {listHeight > 0 ? accountList : null}
          {!presentedList.hasData ? (
            <Stack position="absolute" top={0} right={0} bottom={0} left={0}>
              <EmptyView hasResolved={presentedList.hasResolved} />
            </Stack>
          ) : null}
        </Stack>
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
