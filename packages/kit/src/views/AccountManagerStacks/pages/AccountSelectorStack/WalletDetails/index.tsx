import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual, noop } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { ISortableSectionListRef } from '@onekeyhq/components';
import {
  Icon,
  InputUnControlled,
  SectionList,
  Stack,
  useSafeAreaInsets,
  useSafelyScrollToLocation,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorEditModeAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  accountSelectorAccountsListIsLoadingAtom,
  indexedAccountAddressCreationStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

import { AccountSelectorAccountListItem } from './AccountSelectorAccountListItem';
import { AccountSelectorAddAccountButton } from './AccountSelectorAddAccountButton';
import { EmptyNoAccountsView, EmptyView } from './EmptyView';
import { WalletDetailsHeader } from './WalletDetailsHeader';
import { WalletOptions } from './WalletOptions';

import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';

export interface IWalletDetailsProps {
  num: number;
  wallet?: IDBWallet;
  device?: IDBDevice | undefined;
}

function WalletDetailsView({ num }: IWalletDetailsProps) {
  const intl = useIntl();
  const [editMode, setEditMode] = useAccountSelectorEditModeAtom();
  const { serviceAccount, serviceAccountSelector, serviceNetwork } =
    backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const listRef = useRef<ISortableSectionListRef<any> | null>(null);
  const route = useAccountSelectorRoute();
  const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;
  const linkedNetworkId = linkNetwork ? selectedAccount?.networkId : undefined;
  const [searchText, setSearchText] = useState('');

  defaultLogger.accountSelector.perf.renderAccountsList({
    editMode,
    selectedAccount,
  });

  const navigation = useAppNavigation();

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

  const handleSearch = useDebouncedCallback((text: string) => {
    setSearchText(text?.trim() || '');
  }, 300);

  const {
    result: listDataResult,
    run: reloadAccounts,
    setResult: setListDataResult,
  } = usePromiseResult(
    async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }
      // await timerUtils.wait(1000);
      return serviceAccountSelector.buildAccountSelectorAccountsListData({
        focusedWallet: selectedAccount?.focusedWallet,
        linkedNetworkId,
        deriveType: selectedAccount.deriveType,
        othersNetworkId: selectedAccount?.networkId,
      });
    },
    [
      linkedNetworkId,
      selectedAccount.deriveType,
      selectedAccount?.focusedWallet,
      selectedAccount?.networkId,
      serviceAccountSelector,
    ],
    {
      // debounced: 100,
      checkIsFocused: false,
      watchLoading: false,
      onIsLoadingChange(loading) {
        // setIsLoading(loading);
        void accountSelectorAccountsListIsLoadingAtom.set(loading);
      },
    },
  );
  const sectionDataOriginal = useMemo(
    () => listDataResult?.sectionData || [],
    [listDataResult?.sectionData],
  );
  const sectionData = useMemo(() => {
    if (!searchText) {
      return sectionDataOriginal;
    }
    const sectionDataFiltered: IAccountSelectorAccountsListSectionData[] = [];
    sectionDataOriginal.forEach((section) => {
      const { data, ...others } = section;
      sectionDataFiltered.push({
        ...others,
        data:
          (data as IDBIndexedAccount[])?.filter((item) =>
            item?.name?.toLowerCase()?.includes(searchText?.toLowerCase()),
          ) ?? [],
      });
    });
    return sectionDataFiltered;
  }, [sectionDataOriginal, searchText]);
  const sectionDataRef = useRef(sectionData);
  sectionDataRef.current = sectionData;
  const accountsValue = useMemo(
    () => listDataResult?.accountsValue || [],
    [listDataResult?.accountsValue],
  );
  const accountsCount = useMemo(
    () => listDataResult?.accountsCount ?? 0,
    [listDataResult?.accountsCount],
  );
  const focusedWalletInfo = useMemo(
    () => listDataResult?.focusedWalletInfo,
    [listDataResult?.focusedWalletInfo],
  );

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

  const headerHeightRef = useRef(0);

  // Change the getItemLayout of SectionList to ref calculation, instead of state calculation, to avoid redraws
  const getItemLayout = useCallback(
    (item: ArrayLike<unknown> | undefined | null, index: number) => {
      const getLayoutList = () => {
        let offset = 0;
        const layouts: { offset: number; length: number; index: number }[] = [];
        offset += headerHeightRef?.current ?? 0;
        sectionDataRef?.current?.forEach?.((section, sectionIndex) => {
          if (sectionIndex !== 0) {
            layouts.push({ offset, length: 0, index: layouts.length });
            offset += 0;
          }
          layouts.push({ offset, length: 0, index: layouts.length });
          offset += 0;
          section.data.forEach(() => {
            layouts.push({ offset, length: 60, index: layouts.length });
            offset += 60;
          });
          const footerHeight = 60;
          layouts.push({ offset, length: footerHeight, index: layouts.length });
          offset += footerHeight;
        });
        return layouts;
      };

      if (index === -1) {
        return { index, offset: 0, length: 0 };
      }

      return getLayoutList()[index];
    },
    [],
  );

  const [listViewLayout, setListViewLayout] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    height: 400,
    width: 200,
  });
  const listViewLayoutRef = useRef(listViewLayout);
  listViewLayoutRef.current = listViewLayout;

  const { scrollToLocation, onLayout: handleLayoutForSectionList } =
    useSafelyScrollToLocation(listRef);

  const handleLayoutForContainer = useCallback((e: LayoutChangeEvent) => {
    if (isEqual(listViewLayoutRef.current, e.nativeEvent.layout)) {
      return;
    }
    setListViewLayout(e.nativeEvent.layout);
  }, []);

  const handleLayoutForHeader = useCallback((e: LayoutChangeEvent) => {
    if (headerHeightRef.current === e.nativeEvent.layout.height) {
      return;
    }
    headerHeightRef.current = e.nativeEvent.layout.height;
  }, []);
  const handleLayoutCache = useRef<{
    [key in 'container' | 'header' | 'list']?: () => void;
  }>({});
  const handleLayoutExecuteDebounced = useDebouncedCallback(
    () => {
      Object.values(handleLayoutCache.current).forEach((fn) => {
        fn();
      });
      handleLayoutCache.current = {};
    },
    200,
    { leading: false, trailing: true },
  );
  const handleLayoutCacheSet = useCallback(
    (key: 'container' | 'header' | 'list', fn: () => void) => {
      // *** execute onLayout() immediately which cause re-render many times
      // fn();

      // *** comment out for better performance and disable onLayout() totally
      handleLayoutCache.current[key] = fn;
      handleLayoutExecuteDebounced();
    },
    [handleLayoutExecuteDebounced],
  );
  useEffect(() => {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (listRef?.current?._listRef?._hasDoneInitialScroll) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      listRef.current._listRef._hasDoneInitialScroll = false;
    }
  }, [focusedWalletInfo, searchText]);
  const initialScrollIndex = useMemo(() => {
    if (searchText.length > 0) {
      return undefined;
    }
    if (sectionData?.[0]?.data) {
      const itemIndex = sectionData[0].data?.findIndex(({ id }) =>
        isOthersUniversal
          ? selectedAccount.othersWalletAccountId === id
          : selectedAccount.indexedAccountId === id,
      );
      if (
        listViewLayout.height > 0 &&
        itemIndex * 60 <= listViewLayout.height
      ) {
        return undefined;
      }
      return Math.max(itemIndex + 1, 0);
    }
  }, [
    searchText,
    isOthersUniversal,
    listViewLayout.height,
    sectionData,
    selectedAccount.indexedAccountId,
    selectedAccount.othersWalletAccountId,
  ]);

  // const scrollToTop = useCallback(() => {
  //   if (sectionData?.length) {
  //     scrollToLocation({
  //       animated: true,
  //       sectionIndex: 0,
  //       itemIndex: 0,
  //     });
  //   }
  // }, [scrollToLocation, sectionData]);

  const { bottom } = useSafeAreaInsets();

  // const isEmptyData = useMemo(() => {
  //   let count = 0;
  //   sectionData?.forEach((section) => {
  //     count += section.data.length;
  //   });
  //   return count <= 0;
  // }, [sectionData]);

  const editable = useMemo(() => {
    if (!isEditableRouteParams) {
      return false;
    }
    // if (isOthersUniversal) {
    //   if (
    //     sectionData?.some((section) => {
    //       if (section.data.length) {
    //         return true;
    //       }
    //       return false;
    //     })
    //   ) {
    //     return true;
    //   }
    //   return false;
    // }
    if (!sectionData || sectionData.length === 0) {
      return false;
    }
    return true;
  }, [sectionData, isEditableRouteParams]);

  const title = useMemo(() => {
    if (isOthers) {
      return 'Others';
    }
    return focusedWalletInfo?.wallet?.name || '';
  }, [focusedWalletInfo, isOthers]);

  // useCallback cause re-render when unmount, but useMemo not
  const sectionListMemo = useMemo(
    () => (
      <Stack
        flex={1}
        // TODO performance
        onLayout={(e) => {
          e?.persist?.();
          handleLayoutCacheSet('container', () => handleLayoutForContainer(e));
        }}
      >
        {(() => {
          defaultLogger.accountSelector.perf.renderAccountsSectionList({
            accountsCount,
            walletName: focusedWalletInfo?.wallet?.name,
          });
          return null;
        })()}
        {listViewLayout.height ? (
          <SectionList
            ref={listRef}
            // TODO performance
            onLayout={(e) => {
              e?.persist?.();
              handleLayoutCacheSet('list', () => handleLayoutForSectionList(e));
            }}
            estimatedItemSize={60}
            initialScrollIndex={initialScrollIndex}
            getItemLayout={getItemLayout}
            keyExtractor={(item) =>
              `${editable ? '1' : '0'}_${
                (item as IDBIndexedAccount | IDBAccount).id
              }`
            }
            ListEmptyComponent={<EmptyView />}
            contentContainerStyle={{ pb: '$3' }}
            extraData={[selectedAccount.indexedAccountId, editMode]}
            // {...(wallet?.type !== 'others' && {
            //   ListHeaderComponent: (
            //     <WalletOptions editMode={editMode} wallet={wallet} />
            //   ),
            // })}
            ListHeaderComponent={
              <Stack>
                {isOthersUniversal ? null : (
                  <Stack
                    // TODO performance
                    onLayout={(e) => {
                      e?.persist?.();
                      handleLayoutCacheSet('header', () =>
                        handleLayoutForHeader(e),
                      );
                    }}
                  >
                    <WalletOptions
                      wallet={focusedWalletInfo?.wallet}
                      device={focusedWalletInfo?.device}
                    />
                  </Stack>
                )}
                {accountsCount && accountsCount > 0 ? (
                  <Stack px="$5" py="$2">
                    <InputUnControlled
                      leftIconName="SearchOutline"
                      size="small"
                      allowClear
                      placeholder={intl.formatMessage({
                        id: ETranslations.global_search_account_selector,
                      })}
                      defaultValue={searchText}
                      onChangeText={handleSearch}
                    />
                  </Stack>
                ) : null}
              </Stack>
            }
            sections={sectionData ?? (emptyArray as any)}
            renderSectionHeader={({
              section,
            }: {
              section: IAccountSelectorAccountsListSectionData;
            }) => (
              <>
                {/* If better performance is needed,  */
                /*  a header component should be extracted and data updates should be subscribed to through context" */}
                <EmptyNoAccountsView section={section} />
                {/* No accounts */}
              </>
            )}
            renderItem={({
              item,
              section,
              index,
            }: {
              item: IDBIndexedAccount | IDBAccount;
              section: IAccountSelectorAccountsListSectionData;
              index: number;
            }) => (
              <AccountSelectorAccountListItem
                num={num}
                linkedNetworkId={linkedNetworkId}
                item={item}
                section={section}
                index={index}
                isOthersUniversal={isOthersUniversal}
                selectedAccount={selectedAccount}
                accountsValue={accountsValue}
                linkNetwork={linkNetwork}
                editMode={editMode}
                accountsCount={accountsCount}
                focusedWalletInfo={focusedWalletInfo}
              />
            )}
            renderSectionFooter={({
              section,
            }: {
              section: IAccountSelectorAccountsListSectionData;
            }) =>
              // editable mode and not searching, can add account
              isEditableRouteParams && !searchText ? (
                <AccountSelectorAddAccountButton
                  num={num}
                  isOthersUniversal={isOthersUniversal}
                  section={section}
                  focusedWalletInfo={focusedWalletInfo}
                />
              ) : null
            }
          />
        ) : null}
      </Stack>
    ),
    [
      accountsCount,
      accountsValue,
      editMode,
      editable,
      focusedWalletInfo,
      getItemLayout,
      handleLayoutCacheSet,
      handleLayoutForContainer,
      handleLayoutForHeader,
      handleLayoutForSectionList,
      handleSearch,
      initialScrollIndex,
      intl,
      isEditableRouteParams,
      isOthersUniversal,
      linkNetwork,
      linkedNetworkId,
      listViewLayout.height,
      num,
      searchText,
      sectionData,
      selectedAccount,
    ],
  );

  // Used to find out which deps cause redraws by binary search
  const sectionListMemoMock = useMemo(() => {
    noop([
      accountsCount,
      accountsValue,
      actions,
      editMode, // toggle editMode
      editable,
      focusedWalletInfo,
      handleLayoutForHeader,
      handleLayoutForContainer,
      handleLayoutForSectionList,
      handleLayoutCacheSet,
      initialScrollIndex,
      intl,
      isEditableRouteParams,
      isOthersUniversal,
      // linkNetwork,
      // linkedNetworkId,
      // listViewLayout.height,
      // navigation,
      // num,
      // onDragEnd,
      // renderAccountValue,
      // sectionData,
      // selectedAccount.deriveType,
      // selectedAccount.indexedAccountId,
      // selectedAccount?.networkId,
      // selectedAccount.othersWalletAccountId,
      // serviceAccount,
    ]);
    defaultLogger.accountSelector.perf.render_Accounts_SectionList_Mock();
    return null;
  }, [
    accountsCount,
    accountsValue,
    actions,
    editMode,
    editable,
    focusedWalletInfo,
    handleLayoutForHeader,
    handleLayoutForContainer,
    handleLayoutForSectionList,
    handleLayoutCacheSet,
    initialScrollIndex,
    intl,
    isEditableRouteParams,
    isOthersUniversal,
  ]);

  return (
    <Stack flex={1} pb={bottom} testID="account-selector-accountList">
      <WalletDetailsHeader
        wallet={focusedWalletInfo?.wallet}
        device={focusedWalletInfo?.device}
        titleProps={{
          opacity: editMode && editable ? 0 : 1,
        }}
        editMode={editMode}
        editable={editable}
        linkedNetworkId={linkedNetworkId}
        num={num}
        onEditButtonPress={() => {
          setEditMode((v) => !v);
        }}
        {...(!editMode && {
          title,
        })}
      />
      {sectionListMemo}
      {sectionListMemoMock}
      {/* <DelayedRender delay={1000}>
      </DelayedRender> */}
    </Stack>
  );
}

/* render times:
- init
- atom ready
- fetch data
- onLayout1: Stack onLayout
- onLayout2: SectionList onLayout
- onLayout3: SectionHeader onLayout

accountsValue use array.find but not map
*/
export const WalletDetails = memo(WalletDetailsView);
