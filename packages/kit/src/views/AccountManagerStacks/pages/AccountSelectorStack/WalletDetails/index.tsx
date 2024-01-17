import { useCallback, useEffect, useMemo, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import {
  ActionList,
  Button,
  Icon,
  IconButton,
  ListItem,
  SectionList,
  Skeleton,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import type {
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WalletOptions } from './WalletOptions';

import type { IAccountGroupProps, IAccountProps } from '../../../router/types';

export interface IWalletDetailsProps {
  num: number;
  onAccountPress?: (id: IAccountProps['id']) => void;
  wallet?: IDBWallet;
}

export function WalletDetails({ onAccountPress, num }: IWalletDetailsProps) {
  const [editMode, setEditMode] = useAccountSelectorEditModeAtom();
  const { serviceAccount } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const navigation = useAppNavigation();

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

  const { result: accountsResult, run: reloadAccounts } =
    usePromiseResult(async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }
      return serviceAccount.getAccountsOfWallet({
        walletId: selectedAccount?.focusedWallet,
      });
    }, [selectedAccount?.focusedWallet, serviceAccount]);
  const accounts =
    accountsResult?.accounts ?? (emptyArray as unknown as IDBIndexedAccount[]);

  useEffect(() => {
    const fn = async () => {
      await reloadAccounts();
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
    };
  }, [reloadAccounts]);

  const sectionData = useMemo(
    () => [
      {
        title: '', // focusedWalletInfo?.name ?? '-',
        isHiddenWalletData: false,
        data: accounts,
      },
      // {
      //   title: 'Hidden wallet 1', // focusedWalletInfo?.name ?? '-',
      //   isHiddenWalletData: true,
      //   data: accounts,
      // },
    ],
    [accounts],
  );

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

  return (
    <Stack flex={1} pb={bottom}>
      <ListItem
        mt="$1.5"
        title={focusedWalletInfo?.wallet?.name}
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
          <WalletOptions wallet={focusedWalletInfo?.wallet} />
        }
        sections={sectionData}
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
        renderItem={({ item }: { item: IDBIndexedAccount }) => (
          <ListItem
            key={item.id}
            avatarProps={{
              // eslint-disable-next-line spellcheck/spell-checker
              blockieHash: item.idHash || item.id,
              fallbackProps: {
                children: <Skeleton w="$10" h="$10" />,
              },
              // cornerImageProps: item.networkImageSrc
              //   ? {
              //       src: item.networkImageSrc,
              //       fallbackProps: {
              //         children: <Skeleton w="$4" h="$4" />,
              //       },
              //     }
              //   : undefined,
            }}
            title={item.name}
            titleProps={{
              numberOfLines: 1,
            }}
            // subtitle={item.address}
            subtitle=""
            {...(onAccountPress &&
              !editMode && {
                onPress: () => {
                  if (!focusedWalletInfo) {
                    return;
                  }
                  actions.current.updateSelectedAccount({
                    num,
                    builder: (v) => ({
                      ...v,
                      walletId: focusedWalletInfo?.wallet?.id,
                      accountId: undefined,
                      indexedAccountId: item.id,
                    }),
                  });
                  navigation.popStack();
                },
                checkMark: selectedAccount.indexedAccountId === item.id,
              })}
          >
            <AnimatePresence>
              {editMode && <AccountRenameButton indexedAccount={item} />}
            </AnimatePresence>
          </ListItem>
        )}
        renderSectionFooter={() => (
          <ListItem
            onPress={async () => {
              if (!focusedWalletInfo) {
                return;
              }
              const c = await serviceAccount.addHDNextIndexedAccount({
                walletId: focusedWalletInfo?.wallet?.id,
              });
              console.log('addHDNextIndexedAccount>>>', c);
              await reloadAccounts();

              actions.current.updateSelectedAccount({
                num,
                builder: (v) => ({
                  ...v,
                  indexedAccountId: c.indexedAccountId,
                  walletId: focusedWalletInfo?.wallet?.id,
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
