import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { ISectionListRef } from '@onekeyhq/components';
import {
  ActionList,
  AnimatePresence,
  Button,
  Icon,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  useSafeAreaInsets,
  useSafelyScrollToLocation,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
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
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorAccountsListSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WalletDetailsHeader } from './WalletDetailsHeader';
import { WalletOptions } from './WalletOptions';

import type { RouteProp } from '@react-navigation/core';

export interface IWalletDetailsProps {
  num: number;
  wallet?: IDBWallet;
}

export function WalletDetails({ num }: IWalletDetailsProps) {
  const [editMode, setEditMode] = useAccountSelectorEditModeAtom();
  const { serviceAccount } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const listRef = useRef<ISectionListRef<any> | null>(null);
  const route =
    useRoute<
      RouteProp<
        IAccountManagerStacksParamList,
        EAccountManagerStacksRoutes.AccountSelectorStack
      >
    >();
  const linkNetwork = route.params?.linkNetwork;

  const navigation = useAppNavigation();

  const isOthers = selectedAccount?.focusedWallet === '$$others';

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

  const { result: focusedWalletInfo, run: reloadFocusedWalletInfo } =
    usePromiseResult(
      async () => {
        if (!selectedAccount?.focusedWallet) {
          return undefined;
        }
        const isHd = accountUtils.isHdWallet({
          walletId: selectedAccount?.focusedWallet,
        });
        const isHw = accountUtils.isHwWallet({
          walletId: selectedAccount?.focusedWallet,
        });
        if (isHd || isHw) {
          try {
            const wallet = await serviceAccount.getWallet({
              walletId: selectedAccount?.focusedWallet,
            });

            let device: IDBDevice | undefined;
            if (isHw) {
              device = await serviceAccount.getWalletDevice({
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
    };
    // TODO sync device features to DB and reload data
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [reloadFocusedWalletInfo]);

  const { result: sectionData, run: reloadAccounts } = usePromiseResult(
    async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }

      return serviceAccount.getAccountSelectorAccountsListSectionData({
        focusedWallet: selectedAccount?.focusedWallet,
        linkedNetworkId: linkNetwork ? selectedAccount?.networkId : undefined,
        deriveType: selectedAccount.deriveType,
        othersNetworkId: selectedAccount?.networkId,
      });
    },
    [
      linkNetwork,
      selectedAccount.deriveType,
      selectedAccount?.focusedWallet,
      selectedAccount?.networkId,
      serviceAccount,
    ],
    {
      checkIsFocused: false,
    },
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

  const { scrollToLocation, onLayout } = useSafelyScrollToLocation(listRef);
  // scroll into selected account
  useEffect(() => {
    if (sectionData?.[0]?.data) {
      const itemIndex = sectionData[0].data?.findIndex(({ id }) =>
        isOthers
          ? selectedAccount.othersWalletAccountId === id
          : selectedAccount.indexedAccountId === id,
      );
      console.log('itemIndex----', itemIndex);
      scrollToLocation({
        animated: true,
        sectionIndex: 0,
        itemIndex: Math.max(itemIndex, 0),
      });
    }
  }, [
    isOthers,
    scrollToLocation,
    sectionData,
    selectedAccount.indexedAccountId,
    selectedAccount.othersWalletAccountId,
  ]);

  const [remember, setIsRemember] = useState(false);
  const { bottom } = useSafeAreaInsets();

  const pushImportPrivateKeyModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportPrivateKey,
    });
  }, [navigation]);

  const pushImportAddressModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportAddress,
    });
  }, [navigation]);

  const pushConnectWalletModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWallet,
    });
  }, [navigation]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getAddAccountPressEvent = (type: any) => {
    if (type === 'Private key') return pushImportPrivateKeyModal();
    if (type === 'Watchlist') return pushImportAddressModal();
    if (type === 'External') return pushConnectWalletModal();

    return console.log('clicked');
  };

  const renderSubTitle = useCallback(
    (item: IDBAccount | IDBIndexedAccount) => {
      let address: string | undefined;
      if (isOthers) {
        const account = item as IDBAccount | undefined;
        address = account?.address;
      } else {
        const indexedAccount = item as IDBIndexedAccount | undefined;
        address = indexedAccount?.associateAccount?.address;
      }
      if (!address && !isOthers && linkNetwork) {
        return '--';
      }
      return accountUtils.shortenAddress({
        address,
      });
    },
    [isOthers, linkNetwork],
  );

  // const isEmptyData = useMemo(() => {
  //   let count = 0;
  //   sectionData?.forEach((section) => {
  //     count += section.data.length;
  //   });
  //   return count <= 0;
  // }, [sectionData]);

  const editable = useMemo(() => {
    if (selectedAccount.focusedWallet === '$$others') {
      if (
        sectionData?.some((section) => {
          if (section.data.length) {
            return true;
          }
          return false;
        })
      ) {
        return true;
      }
      return false;
    }
    if (!sectionData || sectionData.length === 0) {
      return false;
    }
    return true;
  }, [sectionData, selectedAccount.focusedWallet]);

  return (
    <Stack flex={1} pb={bottom}>
      <WalletDetailsHeader
        wallet={focusedWalletInfo?.wallet}
        titleProps={{
          opacity: editMode && editable ? 0 : 1,
        }}
        editMode={editMode}
        editable={editable}
        onEditButtonPress={() => {
          setEditMode((v) => !v);
        }}
        {...(!editMode && {
          title: isOthers ? 'Others' : focusedWalletInfo?.wallet?.name,
        })}
      />

      <SectionList
        ref={listRef}
        onLayout={onLayout}
        ListEmptyComponent={
          <Stack p="$3">
            <SizableText>No Wallets</SizableText>
          </Stack>
        }
        contentContainerStyle={{ pb: '$3' }}
        estimatedItemSize="$14"
        extraData={[selectedAccount.indexedAccountId, editMode, remember]}
        // {...(wallet?.type !== 'others' && {
        //   ListHeaderComponent: (
        //     <WalletOptions editMode={editMode} wallet={wallet} />
        //   ),
        // })}
        ListHeaderComponent={
          isOthers ? null : <WalletOptions wallet={focusedWalletInfo?.wallet} />
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
            {section.title && (
              <SectionList.SectionHeader title={section.title}>
                {section.isHiddenWalletData && editMode && (
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
                            label: 'Rename',
                            onPress: () => alert('edit 1112'),
                          },
                          {
                            destructive: true,
                            icon: 'DeleteOutline',
                            label: 'Remove',
                            onPress: () => alert('edit 3332'),
                          },
                        ],
                      },
                    ]}
                  />
                )}
              </SectionList.SectionHeader>
            )}
            {section.data.length === 0 && section.emptyText && (
              <ListItem
                title={section.emptyText}
                titleProps={{
                  size: '$bodyLg',
                }}
              />
            )}
          </>
        )}
        renderItem={({
          item,
        }: {
          item: IDBIndexedAccount | IDBAccount;
          section: IAccountSelectorAccountsListSectionData;
        }) => {
          const account = isOthers ? (item as IDBAccount) : undefined;
          const indexedAccount = isOthers
            ? undefined
            : (item as IDBIndexedAccount);

          return (
            <ListItem
              key={item.id}
              renderAvatar={
                <AccountAvatar
                  fallback={<AccountAvatar.Fallback w="$10" h="$10" />}
                  indexedAccount={isOthers ? undefined : (item as any)}
                  account={isOthers ? (item as any) : undefined}
                />
              }
              title={item.name}
              titleProps={{
                numberOfLines: 1,
              }}
              subtitle={renderSubTitle(item)}
              {...(!editMode && {
                onPress: async () => {
                  if (isOthers) {
                    await actions.current.confirmAccountSelect({
                      num,
                      indexedAccount: undefined,
                      othersWalletAccount: item as IDBAccount,
                      autoChangeToAccountMatchedNetwork: true,
                    });
                  } else if (focusedWalletInfo) {
                    await actions.current.confirmAccountSelect({
                      num,
                      indexedAccount: item as IDBIndexedAccount,
                      othersWalletAccount: undefined,
                      autoChangeToAccountMatchedNetwork: true,
                    });
                  }
                  navigation.popStack();
                },
                checkMark: isOthers
                  ? selectedAccount.othersWalletAccountId === item.id
                  : selectedAccount.indexedAccountId === item.id,
              })}
            >
              {editMode && (
                <>
                  <AccountEditButton
                    account={account}
                    indexedAccount={indexedAccount}
                  />
                  {/* <AccountRemoveButton
                      account={account}
                      indexedAccount={indexedAccount}
                    /> */}
                </>
              )}
            </ListItem>
          );
        }}
        renderSectionFooter={({
          section,
        }: {
          section: IAccountSelectorAccountsListSectionData;
        }) => (
          <ListItem
            onPress={async () => {
              if (isOthers) {
                if (section.walletId === WALLET_TYPE_WATCHING) {
                  handleImportWatchingAccount();
                }
                if (section.walletId === WALLET_TYPE_IMPORTED) {
                  handleImportPrivatekeyAccount();
                }
                return;
              }
              console.log(section);
              if (!focusedWalletInfo) {
                return;
              }
              const c = await serviceAccount.addHDNextIndexedAccount({
                walletId: section.walletId,
              });
              console.log('addHDNextIndexedAccount>>>', c);
              void actions.current.updateSelectedAccount({
                num,
                builder: (v) => ({
                  ...v,
                  walletId: focusedWalletInfo?.wallet?.id,
                  othersWalletAccountId: undefined,
                  indexedAccountId: c.indexedAccountId,
                }),
              });
            }}
          >
            <Stack
              bg="$bgStrong"
              borderRadius="$2"
              p="$2"
              style={{
                borderCurve: 'continuous',
              }}
            >
              <Icon name="PlusSmallOutline" />
            </Stack>
            {/* Add account */}
            <ListItem.Text
              userSelect="none"
              primary="Add Account"
              primaryTextProps={{
                color: '$textSubdued',
              }}
            />
          </ListItem>
        )}
      />
    </Stack>
  );
}
