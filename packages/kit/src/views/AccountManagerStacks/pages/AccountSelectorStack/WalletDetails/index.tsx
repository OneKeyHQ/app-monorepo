import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IButtonProps,
  ISortableSectionListRef,
} from '@onekeyhq/components';
import {
  ActionList,
  Empty,
  Icon,
  IconButton,
  SizableText,
  SortableSectionList,
  Spinner,
  Stack,
  XStack,
  useSafeAreaInsets,
  useSafelyScrollToLocation,
} from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorEditModeAtom,
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { AccountEditButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/AccountEdit';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/pages';
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
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

import { WalletDetailsHeader } from './WalletDetailsHeader';
import { WalletOptions } from './WalletOptions';

import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';

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

export function WalletDetails({ num }: IWalletDetailsProps) {
  const intl = useIntl();
  const [editMode, setEditMode] = useAccountSelectorEditModeAtom();
  const { serviceAccount, serviceAccountSelector } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const listRef = useRef<ISortableSectionListRef<any> | null>(null);
  const route = useAccountSelectorRoute();
  const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;
  const linkedNetworkId = linkNetwork ? selectedAccount?.networkId : undefined;

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

  const { result: focusedWalletInfo, run: reloadFocusedWalletInfo } =
    usePromiseResult(
      async () => {
        if (!selectedAccount?.focusedWallet) {
          return undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const isHd = accountUtils.isHdWallet({
          walletId: selectedAccount?.focusedWallet,
        });
        const isHw = accountUtils.isHwWallet({
          walletId: selectedAccount?.focusedWallet,
        });
        try {
          const wallet = await serviceAccount.getWallet({
            walletId: selectedAccount?.focusedWallet,
          });

          let device: IDBDevice | undefined;
          if (isHw) {
            device = await serviceAccount.getWalletDeviceSafe({
              walletId: selectedAccount?.focusedWallet,
            });
          }

          return {
            wallet,
            device,
          };
        } catch (error) {
          // wallet may be removed
          console.error(error);
          return undefined;
        }
      },
      [selectedAccount?.focusedWallet, serviceAccount],
      {
        checkIsFocused: false,
        // debounced: 100,
      },
    );

  useEffect(() => {
    const fn = async () => {
      // await wait(300);
      await reloadFocusedWalletInfo();
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (listRef?.current?._listRef?._hasDoneInitialScroll) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        listRef.current._listRef._hasDoneInitialScroll = false;
      }
    };
    // TODO sync device features to DB and reload data
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [reloadFocusedWalletInfo]);

  const {
    result: sectionData,
    run: reloadAccounts,
    setResult,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }

      return serviceAccountSelector.getAccountSelectorAccountsListSectionData({
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
      checkIsFocused: false,
      watchLoading: true,
    },
  );

  const { result: accountsValue } = usePromiseResult(async () => {
    const accounts =
      sectionData?.flatMap((section) =>
        section.data.flatMap((item) => ({
          accountId: item.id,
        })),
      ) ?? [];

    const r = await backgroundApiProxy.serviceAccountProfile.getAccountsValue({
      accounts,
    });

    return r;
  }, [sectionData]);

  const accountsCount = useMemo(() => {
    let count = 0;
    sectionData?.forEach?.((s) => {
      s?.data?.forEach?.(() => {
        count += 1;
      });
    });
    return count;
  }, [sectionData]);

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

  const { scrollToLocation, onLayout } = useSafelyScrollToLocation(listRef);

  const [headerHeight, setHeaderHeight] = useState(0);
  const layoutList = useMemo(() => {
    let offset = 0;
    const layouts: { offset: number; length: number; index: number }[] = [];
    offset += headerHeight;
    sectionData?.forEach?.((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        layouts.push({ offset, length: 0, index: layouts.length });
        offset += 0;
      }
      layouts.push({ offset, length: 0, index: layouts.length });
      offset += 0;
      section.data.forEach(() => {
        layouts.push({ offset, length: 56, index: layouts.length });
        offset += 56;
      });
      const footerHeight = 56;
      layouts.push({ offset, length: footerHeight, index: layouts.length });
      offset += footerHeight;
    });
    return layouts;
  }, [sectionData, headerHeight]);

  const [listViewLayout, setListViewLayout] = useState({} as LayoutRectangle);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setListViewLayout(e.nativeEvent.layout);
  }, []);
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
      return { sectionIndex: 0, itemIndex: Math.max(itemIndex, 0) };
    }
  }, [
    isOthersUniversal,
    listViewLayout.height,
    sectionData,
    selectedAccount.indexedAccountId,
    selectedAccount.othersWalletAccountId,
  ]);

  const onDragEnd = useCallback(
    async (result: {
      sections: any;
      from?: { sectionIndex: number; itemIndex: number };
      to?: { sectionIndex: number; itemIndex: number };
    }) => {
      const sectionIndex = result?.from?.sectionIndex;
      if (!sectionData) {
        return;
      }
      if (
        sectionIndex === undefined ||
        sectionIndex !== result?.to?.sectionIndex
      ) {
        return;
      }

      const fromIndex = result?.from?.itemIndex;
      let toIndex = result?.to?.itemIndex;
      if (fromIndex === undefined || toIndex === undefined) {
        return;
      }

      if (toIndex > fromIndex) {
        toIndex += 1;
      }
      const sectionDataList = sectionData[sectionIndex].data;
      if (
        sectionIndex === sectionData.length - 1 &&
        toIndex === sectionDataList.length - 1
      ) {
        return;
      }
      setResult(result.sections);

      if (isOthersUniversal) {
        await serviceAccount.insertAccountOrder({
          targetAccountId: sectionDataList?.[fromIndex]?.id,
          startAccountId: sectionDataList?.[toIndex - 1]?.id,
          endAccountId: sectionDataList?.[toIndex]?.id,
          emitEvent: true,
        });
      } else {
        await serviceAccount.insertIndexedAccountOrder({
          targetIndexedAccountId: sectionDataList?.[fromIndex]?.id,
          startIndexedAccountId: sectionDataList?.[toIndex - 1]?.id,
          endIndexedAccountId: sectionDataList?.[toIndex]?.id,
          emitEvent: true,
        });
      }
    },
    [isOthersUniversal, serviceAccount, sectionData, setResult],
  );

  // const scrollToTop = useCallback(() => {
  //   if (sectionData?.length) {
  //     scrollToLocation({
  //       animated: true,
  //       sectionIndex: 0,
  //       itemIndex: 0,
  //     });
  //   }
  // }, [scrollToLocation, sectionData]);

  const [remember, setIsRemember] = useState(false);
  const { bottom } = useSafeAreaInsets();

  const buildSubTitleInfo = useCallback(
    (item: IDBAccount | IDBIndexedAccount) => {
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
      if (!address && !isOthersUniversal && linkNetwork && !allowEmptyAddress) {
        // TODO custom style
        return {
          address: intl.formatMessage(
            { id: ETranslations.global_no_network_address },
            {
              network: activeAccount?.network?.shortname || '',
            },
          ),
          isEmptyAddress: true,
        };
      }
      return {
        address: address
          ? accountUtils.shortenAddress({
              address,
            })
          : '',
        isEmptyAddress: false,
      };
    },
    [activeAccount?.network?.shortname, intl, isOthersUniversal, linkNetwork],
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

  const toOnBoardingPage = useToOnBoardingPage();

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
        onEditButtonPress={() => {
          setEditMode((v) => !v);
        }}
        {...(!editMode && {
          title,
        })}
      />
      <Stack flex={1} onLayout={handleLayout}>
        {listViewLayout.height ? (
          <SortableSectionList
            ref={listRef}
            onLayout={onLayout}
            enabled={editMode}
            onDragEnd={onDragEnd}
            initialScrollIndex={initialScrollIndex}
            getItemLayout={(item, index) => {
              if (index === -1) {
                return { index, offset: 0, length: 0 };
              }
              return layoutList[index];
            }}
            keyExtractor={(item) =>
              `${editable ? '1' : '0'}_${
                (item as IDBIndexedAccount | IDBAccount).id
              }`
            }
            ListEmptyComponent={
              isLoading ? (
                <Stack py="$20">
                  <Spinner size="large" />
                </Stack>
              ) : (
                <Empty
                  mt="$24"
                  icon="WalletOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_wallet,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.global_no_wallet_desc,
                  })}
                  buttonProps={{
                    children: intl.formatMessage({
                      id: ETranslations.global_create_wallet,
                    }),
                    onPress: () => {
                      void toOnBoardingPage({
                        params: {
                          showCloseButton: true,
                        },
                      });
                    },
                  }}
                />
              )
            }
            contentContainerStyle={{ pb: '$3' }}
            extraData={[selectedAccount.indexedAccountId, editMode, remember]}
            // {...(wallet?.type !== 'others' && {
            //   ListHeaderComponent: (
            //     <WalletOptions editMode={editMode} wallet={wallet} />
            //   ),
            // })}
            ListHeaderComponent={
              isOthersUniversal ? null : (
                <Stack
                  onLayout={({
                    nativeEvent: {
                      layout: { height },
                    },
                  }) => {
                    setHeaderHeight(height);
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
                {section.title ? (
                  <SortableSectionList.SectionHeader title={section.title}>
                    {section.isHiddenWalletData && editMode ? (
                      <ActionList
                        title={section.title}
                        renderTrigger={
                          <IconButton
                            icon="DotHorOutline"
                            variant="tertiary"
                            ml="$2"
                          />
                        }
                        sections={[
                          {
                            items: [
                              {
                                icon: remember
                                  ? 'CheckboxSolid'
                                  : 'SuqarePlaceholderOutline',
                                ...(remember && {
                                  iconProps: {
                                    color: '$iconActive',
                                  },
                                }),
                                label: 'Remember',
                                onPress: () => setIsRemember(!remember),
                              },
                            ],
                          },
                          {
                            items: [
                              {
                                icon: 'PencilOutline',
                                label: intl.formatMessage({
                                  id: ETranslations.global_rename,
                                }),
                                onPress: () => alert('edit 1112'),
                              },
                              {
                                destructive: true,
                                icon: 'DeleteOutline',
                                label: intl.formatMessage({
                                  id: ETranslations.global_remove,
                                }),
                                onPress: () => alert('edit 3332'),
                              },
                            ],
                          },
                        ]}
                      />
                    ) : null}
                  </SortableSectionList.SectionHeader>
                ) : null}
                {section.data.length === 0 && section.emptyText ? (
                  <ListItem
                    title={section.emptyText}
                    titleProps={{
                      size: '$bodyLg',
                    }}
                  />
                ) : null}
              </>
            )}
            renderItem={({
              item,
              drag,
              section,
            }: {
              item: IDBIndexedAccount | IDBAccount;
              section: IAccountSelectorAccountsListSectionData;
              drag?: () => void;
            }) => {
              const account = isOthersUniversal
                ? (item as IDBAccount)
                : undefined;
              const indexedAccount = isOthersUniversal
                ? undefined
                : (item as IDBIndexedAccount);

              const subTitleInfo = buildSubTitleInfo(item);
              const accountValue = accountsValue?.find(
                (i) => i.accountId === item.id,
              );
              const shouldShowCreateAddressButton =
                linkNetwork && subTitleInfo.isEmptyAddress;

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

              return (
                <ListItem
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
                        <XStack alignItems="center" space="$1">
                          {accountValue && accountValue.currency ? (
                            <Currency
                              size="$bodyMd"
                              color="$textSubdued"
                              sourceCurrency={accountValue.currency}
                            >
                              {accountValue?.value}
                            </Currency>
                          ) : null}
                          {accountValue &&
                          accountValue.currency &&
                          subTitleInfo.address ? (
                            <SizableText size="$bodyMd" color="textSubdued">
                              ·
                            </SizableText>
                          ) : null}
                          <SizableText
                            size="$bodyMd"
                            color={
                              subTitleInfo.isEmptyAddress
                                ? '$textCaution'
                                : '$textSubdued'
                            }
                          >
                            {subTitleInfo.address}
                          </SizableText>
                        </XStack>
                      }
                    />
                  )}
                  // childrenBefore={
                  //   editMode ? (
                  //     <ListItem.IconButton
                  //       mr="$1"
                  //       cursor="move"
                  //       icon="DragOutline"
                  //       onPressIn={drag}
                  //     />
                  //   ) : null
                  // }
                  {...(!editMode && {
                    onPress: async () => {
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
                    },
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
    </Stack>
  );
}
