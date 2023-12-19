import { useCallback, useState } from 'react';

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

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { EOnboardingPages } from '../../../Onboarding/router/type';

import { WalletOptions } from './WalletOptions';

import type {
  IAccountGroupProps,
  IAccountProps,
  IWalletProps,
} from '../../types';

export interface IWalletDetailsProps {
  wallet?: IWalletProps;
  selectedAccountId?: IAccountProps['id'];
  editMode?: boolean;
  onEditButtonPress?: IButtonProps['onPress'];
  onAccountPress?: (id: IAccountProps['id']) => void;
}

export function WalletDetails({
  wallet,
  selectedAccountId,
  editMode,
  onEditButtonPress,
  onAccountPress,
}: IWalletDetailsProps) {
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
        title={wallet?.name}
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
        extraData={[selectedAccountId, remember]}
        estimatedItemSize="$14"
        {...(wallet?.type !== 'others' && {
          ListHeaderComponent: (
            <WalletOptions editMode={editMode} wallet={wallet} />
          ),
        })}
        sections={wallet?.accounts || []}
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
            {section.data.length === 0 && (
              <ListItem
                title="Empty state. Nostrud est eiusmod pariatur cupidatat mollit qui laborum. Consectetur nisi pariatur minim ipsum."
                titleProps={{
                  size: '$bodyLg',
                }}
              />
            )}
          </>
        )}
        renderItem={({ item }: { item: IAccountProps }) => (
          <ListItem
            key={item.id}
            avatarProps={{
              // eslint-disable-next-line spellcheck/spell-checker
              src: makeBlockie(item.evmAddress || item.address || ''),
              fallbackProps: {
                children: <Skeleton w="$10" h="$10" />,
              },
              cornerImageProps: item.networkImageSrc
                ? {
                    src: item.networkImageSrc,
                    fallbackProps: {
                      children: <Skeleton w="$4" h="$4" />,
                    },
                  }
                : undefined,
            }}
            title={item.name}
            titleProps={{
              numberOfLines: 1,
            }}
            subtitle={item.address}
            {...(onAccountPress &&
              !editMode && {
                onPress: () => onAccountPress(item.id),
                checkMark: selectedAccountId === item.id,
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
          <ListItem onPress={() => getAddAccountPressEvent(section.title)}>
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
