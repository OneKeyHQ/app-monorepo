import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { AnimatePresence } from 'tamagui';

import {
  ActionList,
  Button,
  Icon,
  IconButton,
  SectionList,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useAccountSelectorActions,
  useAccountSelectorEditModeAtom,
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { AccountRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/AccountRename';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import {
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/kit-bg/src/dbs/local/consts';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSectionData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WalletOptions } from './WalletOptions';

import type {
  EAccountManagerStacksRoutes,
  IAccountGroupProps,
  IAccountManagerStacksParamList,
} from '../../../router/types';
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
        }
      },
      [selectedAccount?.focusedWallet, serviceAccount],
      {
        checkIsFocused: false,
      },
    );

  useEffect(() => {
    const fn = async () => {
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
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
    };
  }, [reloadAccounts]);

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

  return (
    <Stack flex={1} pb={bottom}>
      <ListItem
        mt="$1.5"
        title={isOthers ? 'Others' : focusedWalletInfo?.wallet?.name}
        titleProps={{
          animation: 'quick',
          opacity: editMode ? 0 : 1,
        }}
      >
        <Button
          variant="tertiary"
          onPress={() => {
            setEditMode((v) => !v);
          }}
        >
          {editMode ? 'Done' : 'Edit'}
        </Button>
      </ListItem>

      <SectionList
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
        renderSectionHeader={({ section }: { section: IAccountGroupProps }) => (
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
          section: IAccountGroupProps;
        }) => (
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
              onPress: () => {
                if (isOthers) {
                  actions.current.updateSelectedAccount({
                    num,
                    builder: (v) => ({
                      ...v,
                      walletId: accountUtils.getWalletIdFromAccountId({
                        accountId: item.id,
                      }),
                      othersWalletAccountId: item.id,
                      indexedAccountId: undefined,
                    }),
                    othersWalletAccountId: item.id,
                    indexedAccountId: undefined,
                  });
                } else if (focusedWalletInfo) {
                  actions.current.updateSelectedAccount({
                    num,
                    builder: (v) => ({
                      ...v,
                      walletId: focusedWalletInfo?.wallet?.id,
                      othersWalletAccountId: undefined,
                      indexedAccountId: item.id,
                    }),
                  });
                }
                navigation.popStack();
              },
              checkMark: isOthers
                ? selectedAccount.othersWalletAccountId === item.id
                : selectedAccount.indexedAccountId === item.id,
            })}
          >
            <AnimatePresence>
              {editMode && (
                <AccountRenameButton
                  account={isOthers ? (item as IDBAccount) : undefined}
                  indexedAccount={
                    isOthers ? undefined : (item as IDBIndexedAccount)
                  }
                />
              )}
            </AnimatePresence>
          </ListItem>
        )}
        renderSectionFooter={({
          section,
        }: {
          section: IAccountSelectorSectionData;
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
              actions.current.updateSelectedAccount({
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
              primary="Add account"
              primaryTextProps={{
                size: '$bodyLg',
              }}
            />
          </ListItem>
        )}
      />

      {selectedAccount?.focusedWallet &&
        !focusedWalletInfo?.wallet?.passphraseState &&
        accountUtils.isHwWallet({
          walletId: selectedAccount?.focusedWallet,
        }) && (
          <>
            <ListItem
              onPress={async () => {
                if (!focusedWalletInfo) {
                  return;
                }
                // features is not sync from device
                // if (
                //   !focusedWalletInfo.device?.featuresInfo?.passphrase_protection
                // ) {
                //   alert('硬件没有开启 passphrase');
                //   return;
                // }
                await actions.current.createHWHiddenWallet({
                  walletId: focusedWalletInfo?.wallet?.id,
                });
                await reloadAccounts();
                console.log(
                  'add hidden wallet from device: ',
                  focusedWalletInfo,
                );
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
                primary="Add Hidden Wallet"
                primaryTextProps={{
                  size: '$bodyLg',
                }}
              />
            </ListItem>
            <Button
              onPress={() => {
                void backgroundApiProxy.serviceHardware.inputPassphraseOnDevice();
              }}
            >
              在硬件输入passphrase
            </Button>
          </>
        )}
    </Stack>
  );
}
