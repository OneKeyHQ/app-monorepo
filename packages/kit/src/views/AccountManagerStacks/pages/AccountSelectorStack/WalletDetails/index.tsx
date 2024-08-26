import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEqual, noop } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type {
  IButtonProps,
  ISortableSectionListRef,
} from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  XStack,
  useSafeAreaInsets,
  useSafelyScrollToLocation,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorEditModeAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { AccountEditButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/AccountEdit';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { accountSelectorAccountsListIsLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

import { AccountAddress } from './AccountAddress';
import { AccountValue } from './AccountValue';
import { EmptyNoAccountsView, EmptyView } from './EmptyView';
import { WalletDetailsHeader } from './WalletDetailsHeader';
import { WalletOptions } from './WalletOptions';

import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IWalletDetailsProps {
  num: number;
  wallet?: IDBWallet;
  device?: IDBDevice | undefined;
}

function PlusButton({ onPress, loading }: IButtonProps) {
  return (
    <IconButton
      borderWidth={0}
      borderRadius="$2"
      variant="tertiary"
      size="medium"
      loading={loading}
      onPress={onPress}
      icon="PlusSmallOutline"
    />
  );
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

  const handleImportWatchingAccount = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportAddress,
    });
  }, [navigation]);

  const handleImportPrivatekeyAccount = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportPrivateKey,
    });
  }, [navigation]);

  const handleAddExternalAccount = useCallback(() => {
    console.log('handleAddExternalAccount');
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletSelectNetworks,
    });
  }, [navigation]);

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
  const sectionData = useMemo(
    () => listDataResult?.sectionData || [],
    [listDataResult?.sectionData],
  );
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
  }, [focusedWalletInfo]);
  const initialScrollIndex = useMemo(() => {
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

  const buildSubTitleInfo = useCallback(
    (
      item: IDBAccount | IDBIndexedAccount,
    ): {
      linkedNetworkId: string | undefined;
      address: string;
      isEmptyAddress: boolean;
    } => {
      let address: string | undefined;
      let allowEmptyAddress = false;
      if (isOthersUniversal) {
        const account = item as IDBAccount | undefined;
        address = account?.address;
      } else {
        const indexedAccount = item as IDBIndexedAccount | undefined;
        const associateAccount = indexedAccount?.associateAccount;
        address = associateAccount?.address;

        if (
          associateAccount?.addressDetail?.isValid &&
          associateAccount?.addressDetail?.normalizedAddress
        ) {
          allowEmptyAddress = true;
        }
      }
      if (
        !address &&
        !isOthersUniversal &&
        linkedNetworkId &&
        !allowEmptyAddress
      ) {
        // TODO custom style
        return {
          linkedNetworkId,
          address: '',
          isEmptyAddress: true,
        };
      }
      return {
        linkedNetworkId: undefined,
        address: address
          ? accountUtils.shortenAddress({
              address,
            })
          : '',
        isEmptyAddress: false,
      };
    },
    [isOthersUniversal, linkedNetworkId],
  );

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

  const renderAccountValue = useCallback(
    ({
      index,
      accountValue,
      subTitleInfo,
    }: {
      index: number;
      accountValue:
        | {
            accountId: string;
            currency: string | undefined;
            value: string | undefined;
          }
        | undefined;
      subTitleInfo: { address: string | undefined; isEmptyAddress: boolean };
    }) => {
      if (linkNetwork) return null;

      const shouldShowSpotlight = !isOthersUniversal && index === 0;

      return (
        <>
          <Spotlight
            containerProps={{ flexShrink: 1 }}
            isVisible={shouldShowSpotlight && !platformEnv.isE2E}
            message={intl.formatMessage({
              id: ETranslations.spotlight_enable_account_asset_message,
            })}
            tourName={ESpotlightTour.allNetworkAccountValue}
          >
            {accountValue && accountValue.currency ? (
              <AccountValue
                accountId={accountValue.accountId}
                currency={accountValue.currency}
                value={accountValue.value ?? ''}
              />
            ) : (
              <SizableText size="$bodyMd" color="$textDisabled">
                --
              </SizableText>
            )}
          </Spotlight>
          {subTitleInfo.address ? (
            <Stack
              mx="$1.5"
              w="$1"
              h="$1"
              bg="$iconSubdued"
              borderRadius="$full"
            />
          ) : null}
        </>
      );
    },
    [linkNetwork, isOthersUniversal, intl],
  );

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
              isOthersUniversal ? null : (
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
              )
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
            }) => {
              const account = isOthersUniversal
                ? (item as IDBAccount)
                : undefined;
              const indexedAccount = isOthersUniversal
                ? undefined
                : (item as IDBIndexedAccount);

              const subTitleInfo = buildSubTitleInfo(item);

              // TODO performance
              const accountValue = accountsValue?.find(
                (i) => i.accountId === item.id,
              );
              const shouldShowCreateAddressButton = !!(
                linkNetwork && subTitleInfo.isEmptyAddress
              );

              const actionButton = (() => {
                if (editMode) {
                  return (
                    <>
                      {/* TODO rename to AccountEditTrigger */}
                      <AccountEditButton
                        accountsCount={accountsCount}
                        indexedAccount={indexedAccount}
                        firstIndexedAccount={
                          isOthersUniversal
                            ? undefined
                            : (section?.data?.[0] as IDBIndexedAccount)
                        }
                        account={account}
                        firstAccount={
                          isOthersUniversal
                            ? (section?.data?.[0] as IDBAccount)
                            : undefined
                        }
                        wallet={focusedWalletInfo?.wallet}
                      />
                    </>
                  );
                }
                if (shouldShowCreateAddressButton) {
                  return (
                    <AccountSelectorCreateAddressButton
                      num={num}
                      selectAfterCreate
                      account={{
                        walletId: focusedWalletInfo?.wallet?.id,
                        networkId: linkedNetworkId,
                        indexedAccountId: indexedAccount?.id,
                        deriveType: selectedAccount.deriveType,
                      }}
                      buttonRender={PlusButton}
                    />
                  );
                }
                return null;
              })();

              let avatarNetworkId: string | undefined;
              if (isOthersUniversal && account) {
                avatarNetworkId = accountUtils.getAccountCompatibleNetwork({
                  account,
                  networkId: linkNetwork
                    ? selectedAccount?.networkId
                    : account.createAtNetwork,
                });
              }
              if (!avatarNetworkId && indexedAccount && linkNetwork) {
                avatarNetworkId = selectedAccount?.networkId;
              }

              const canConfirmAccountSelectPress =
                !editMode && !shouldShowCreateAddressButton;

              return (
                <ListItem
                  testID={`account-item-index-${index}`}
                  key={item.id}
                  renderAvatar={
                    <AccountAvatar
                      loading={<AccountAvatar.Loading w="$10" h="$10" />}
                      indexedAccount={indexedAccount}
                      account={account as any}
                      networkId={avatarNetworkId}
                    />
                  }
                  renderItemText={(textProps) => (
                    <ListItem.Text
                      {...textProps}
                      flex={1}
                      primary={
                        <SizableText size="$bodyLgMedium" numberOfLines={1}>
                          {item.name}
                        </SizableText>
                      }
                      secondary={
                        <XStack alignItems="center">
                          {renderAccountValue({
                            index,
                            accountValue,
                            subTitleInfo,
                          })}
                          <AccountAddress
                            num={num}
                            linkedNetworkId={subTitleInfo.linkedNetworkId}
                            address={subTitleInfo.address}
                            isEmptyAddress={subTitleInfo.isEmptyAddress}
                          />
                        </XStack>
                      }
                    />
                  )}
                  {...(!editMode && {
                    onPress: canConfirmAccountSelectPress
                      ? async () => {
                          // show CreateAddress Button here, disabled confirmAccountSelect()
                          if (shouldShowCreateAddressButton) {
                            return;
                          }
                          if (isOthersUniversal) {
                            let autoChangeToAccountMatchedNetworkId =
                              avatarNetworkId;
                            if (
                              selectedAccount?.networkId &&
                              networkUtils.isAllNetwork({
                                networkId: selectedAccount?.networkId,
                              })
                            ) {
                              autoChangeToAccountMatchedNetworkId =
                                selectedAccount?.networkId;
                            }
                            await actions.current.confirmAccountSelect({
                              num,
                              indexedAccount: undefined,
                              othersWalletAccount: account,
                              autoChangeToAccountMatchedNetworkId,
                            });
                          } else if (focusedWalletInfo) {
                            await actions.current.confirmAccountSelect({
                              num,
                              indexedAccount,
                              othersWalletAccount: undefined,
                              autoChangeToAccountMatchedNetworkId: undefined,
                            });
                          }
                          navigation.popStack();
                        }
                      : undefined,
                    checkMark: (() => {
                      // show CreateAddress Button here, hide checkMark
                      if (shouldShowCreateAddressButton) {
                        return undefined;
                      }
                      return isOthersUniversal
                        ? selectedAccount.othersWalletAccountId === item.id
                        : selectedAccount.indexedAccountId === item.id;
                    })(),
                  })}
                >
                  {actionButton}
                </ListItem>
              );
            }}
            renderSectionFooter={({
              section,
            }: {
              section: IAccountSelectorAccountsListSectionData;
            }) =>
              isEditableRouteParams ? (
                <ListItem
                  testID="account-add-account"
                  onPress={async () => {
                    if (isOthersUniversal) {
                      if (section.walletId === WALLET_TYPE_WATCHING) {
                        handleImportWatchingAccount();
                      }
                      if (section.walletId === WALLET_TYPE_IMPORTED) {
                        handleImportPrivatekeyAccount();
                      }
                      if (section.walletId === WALLET_TYPE_EXTERNAL) {
                        handleAddExternalAccount();
                      }
                      return;
                    }
                    if (!focusedWalletInfo) {
                      return;
                    }
                    const c = await serviceAccount.addHDNextIndexedAccount({
                      walletId: section.walletId,
                    });
                    console.log('addHDNextIndexedAccount>>>', c);
                    void actions.current.updateSelectedAccountForHdOrHwAccount({
                      num,
                      walletId: focusedWalletInfo?.wallet?.id,
                      indexedAccountId: c.indexedAccountId,
                    });
                  }}
                >
                  <Stack
                    bg="$bgStrong"
                    borderRadius="$2"
                    p="$2"
                    borderCurve="continuous"
                  >
                    <Icon name="PlusSmallOutline" />
                  </Stack>
                  {/* Add account */}
                  <ListItem.Text
                    userSelect="none"
                    primary={intl.formatMessage({
                      id: ETranslations.global_add_account,
                    })}
                    primaryTextProps={{
                      color: '$textSubdued',
                    }}
                  />
                </ListItem>
              ) : null
            }
          />
        ) : null}
      </Stack>
    ),
    [
      accountsCount,
      accountsValue,
      actions,
      buildSubTitleInfo,
      editMode,
      editable,
      focusedWalletInfo,
      getItemLayout,
      handleAddExternalAccount,
      handleImportPrivatekeyAccount,
      handleImportWatchingAccount,
      handleLayoutCacheSet,
      handleLayoutForContainer,
      handleLayoutForHeader,
      handleLayoutForSectionList,
      initialScrollIndex,
      intl,
      isEditableRouteParams,
      isOthersUniversal,
      linkNetwork,
      linkedNetworkId,
      listViewLayout.height,
      navigation,
      num,
      renderAccountValue,
      sectionData,
      selectedAccount.deriveType,
      selectedAccount.indexedAccountId,
      selectedAccount?.networkId,
      selectedAccount.othersWalletAccountId,
      serviceAccount,
    ],
  );

  // Used to find out which deps cause redraws by binary search
  const sectionListMemoMock = useMemo(() => {
    noop([
      accountsCount,
      accountsValue,
      actions,
      buildSubTitleInfo,
      editMode, // toggle editMode
      editable,
      focusedWalletInfo,
      handleAddExternalAccount,
      handleLayoutForHeader,
      handleLayoutForContainer,
      handleLayoutForSectionList,
      handleLayoutCacheSet,
      handleImportPrivatekeyAccount,
      handleImportWatchingAccount,
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
    buildSubTitleInfo,
    editMode,
    editable,
    focusedWalletInfo,
    handleAddExternalAccount,
    handleLayoutForHeader,
    handleLayoutForContainer,
    handleLayoutForSectionList,
    handleLayoutCacheSet,
    handleImportPrivatekeyAccount,
    handleImportWatchingAccount,
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
