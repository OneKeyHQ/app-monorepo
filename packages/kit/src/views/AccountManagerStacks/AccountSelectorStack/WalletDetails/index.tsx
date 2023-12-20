import { useCallback, useMemo, useState } from 'react';

// eslint-disable-next-line spellcheck/spell-checker
import makeBlockie from 'ethereum-blockies-base64';
import { AnimatePresence } from 'tamagui';

import type { IButtonProps } from '@onekeyhq/components';
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
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../../routes/Modal/type';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '../../../../states/jotai/contexts/accountSelector';
import { EOnboardingPages } from '../../../Onboarding/router/type';

import { WalletOptions } from './WalletOptions';

import type {
  IAccountGroupProps,
  IAccountProps,
  IWalletProps,
} from '../../types';

export interface IWalletDetailsProps {
  num: number;
  editMode?: boolean;
  onEditButtonPress?: IButtonProps['onPress'];
  onAccountPress?: (id: IAccountProps['id']) => void;
  wallet?: IWalletProps;
}

export function WalletDetails({
  editMode,
  onEditButtonPress,
  onAccountPress,
  num,
}: IWalletDetailsProps) {
  const { serviceAccount } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const { result: focusedWalletInfo } = usePromiseResult(async () => {
    if (
      selectedAccount?.focusedWallet &&
      accountUtils.isHdWallet({
        walletId: selectedAccount?.focusedWallet,
      })
    ) {
      const wallet0 = await serviceAccount.getWallet({
        walletId: selectedAccount?.focusedWallet,
      });
      return wallet0;
    }
  }, [selectedAccount?.focusedWallet, serviceAccount]);

  const { result: accountsResult, run: refreshAccounts } =
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

  const sectionData = useMemo(
    () => [
      {
        title: '', // focusedWalletInfo?.name ?? '-',
        isHiddenWalletData: false,
        data: accounts,
      },
    ],
    [accounts],
  );

  const [remember, setIsRemember] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();

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
        title={focusedWalletInfo?.name}
        titleProps={{
          animation: 'quick',
          opacity: editMode ? 0 : 1,
        }}
      >
        <Button variant="tertiary" onPress={onEditButtonPress}>
          {editMode ? 'Done' : 'Edit'}
        </Button>
      </ListItem>
      <SectionList
        pb="$3"
        estimatedItemSize="$14"
        // extraData={[selectedAccountId, remember]}
        // {...(wallet?.type !== 'others' && {
        //   ListHeaderComponent: (
        //     <WalletOptions editMode={editMode} wallet={wallet} />
        //   ),
        // })}
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
                            onPress: () => alert('edit'),
                          },
                          {
                            destructive: true,
                            icon: 'DeleteOutline',
                            label: 'Remove',
                            onPress: () => alert('edit'),
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
              src: makeBlockie(item.idHash || item.id),
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
                      walletId: focusedWalletInfo?.id,
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
              {editMode && (
                <ActionList
                  title={item.name}
                  renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
                  items={[
                    {
                      icon: 'PencilOutline',
                      label: 'Rename',
                      onPress: () => alert('edit'),
                    },
                  ]}
                />
              )}
            </AnimatePresence>
          </ListItem>
        )}
        renderSectionFooter={({ section }: { section: IAccountGroupProps }) => (
          <ListItem
            onPress={async () => {
              // getAddAccountPressEvent(section.title)
              // to Private key
              if (!focusedWalletInfo) {
                return;
              }
              const c = await serviceAccount.addHDNextIndexedAccount({
                walletId: focusedWalletInfo?.id,
              });
              console.log('addHDNextIndexedAccount>>>', c);
              await refreshAccounts();

              actions.current.updateSelectedAccount({
                num,
                builder: (v) => ({
                  ...v,
                  indexedAccountId: c.indexedAccountId,
                  walletId: focusedWalletInfo?.id,
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
    </Stack>
  );
}
