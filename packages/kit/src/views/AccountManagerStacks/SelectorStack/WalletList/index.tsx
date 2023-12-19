import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  ActionList,
  IconButton,
  ListView,
  Page,
  Stack,
  Text,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { EOnboardingPages } from '../../../Onboarding/router/type';

import { WalletListItem } from './WalletListItem';

import type { IWalletProps } from '../../types';

function ListItemSeparator() {
  return <Stack h="$3" />;
}

interface IWalletListProps {
  selectedWalletId?: IWalletProps['id'];
  primaryWallets?: IWalletProps[];
  othersWallet?: IWalletProps;
  onWalletPress?: (id: IWalletProps['id']) => void;
}

export function WalletList({
  primaryWallets,
  othersWallet,
  onWalletPress,
  selectedWalletId,
}: IWalletListProps) {
  const media = useMedia();
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();

  const handleConnectHardwareWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [navigation]);

  const handleCreateWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

  const handleImportWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportRecoveryPhrase,
    });
  }, [navigation]);

  return (
    <Stack
      $gtMd={{
        w: '$32',
      }}
      py="$2"
      bg="$bgSubdued"
      borderRightWidth={StyleSheet.hairlineWidth}
      borderRightColor="$neutral3"
    >
      {/* Close action */}
      {(platformEnv.isExtension || platformEnv.isNativeAndroid) && (
        <XStack px="$5" py="$3.5">
          <Page.Close>
            <HeaderIconButton icon="CrossedLargeOutline" />
          </Page.Close>
        </XStack>
      )}
      {/* Primary wallets */}
      <ListView
        estimatedItemSize="$10"
        data={primaryWallets}
        extraData={selectedWalletId}
        renderItem={({ item }: { item: IWalletProps }) => (
          <WalletListItem
            key={item.id}
            walletName={item.name}
            selected={item.id === selectedWalletId}
            onPress={() => onWalletPress && onWalletPress(item.id)}
            walletAvatarProps={{
              img: item.img,
              status: item.status,
            }}
          />
        )}
        ItemSeparatorComponent={ListItemSeparator}
        ListFooterComponent={
          <Stack p="$1" alignItems="center" mt="$3">
            {/* <IconButton
              icon="PlusSmallOutline"
              onPress={handleCreateWalletPress}
            /> */}
            <ActionList
              placement="right-start"
              renderTrigger={<IconButton icon="PlusSmallOutline" />}
              title="Add wallet"
              items={[
                {
                  label: 'Connect Hardware Wallet',
                  icon: platformEnv.isNative
                    ? 'BluetoothOutline'
                    : 'UsbOutline',
                  onPress: handleConnectHardwareWalletPress,
                },
                {
                  label: 'Create New Wallet',
                  icon: 'Ai2StarOutline',
                  onPress: handleCreateWalletPress,
                },
                {
                  label: 'Import Recovery Phrase',
                  icon: 'DownloadOutline',
                  onPress: handleImportWalletPress,
                },
              ]}
            />
            {media.gtMd && (
              <Text variant="$bodySm" color="$textSubdued" mt="$1">
                Add wallet
              </Text>
            )}
          </Stack>
        }
      />
      {/* Others */}
      {othersWallet && (
        <Stack pb={bottom}>
          <WalletListItem
            walletName={othersWallet.name}
            selected={othersWallet.id === selectedWalletId}
            onPress={() => onWalletPress && onWalletPress(othersWallet.id)}
            walletAvatarProps={{
              img: othersWallet.img,
            }}
          />
        </Stack>
      )}
    </Stack>
  );
}
