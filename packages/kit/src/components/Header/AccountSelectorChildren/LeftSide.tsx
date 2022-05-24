import React, { ComponentProps, FC } from 'react';

import {
  Box,
  HStack,
  IconButton,
  Pressable,
  ScrollView,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { setHaptics } from '../../../hooks/setHaptics';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { getDeviceTypeByDeviceId } from '../../../utils/device/ble/OnekeyHardware';
import WalletAvatar from '../WalletAvatar';

import type { AccountType } from './index';

type WalletItemProps = {
  isSelected?: boolean;
  walletType?: AccountType;
} & ComponentProps<typeof Pressable> &
  ComponentProps<typeof WalletAvatar>;

const WalletItem: FC<WalletItemProps> = ({ isSelected, ...rest }) => (
  <Pressable {...rest}>
    {({ isHovered }) => (
      <HStack pr={2} space="5px">
        <Box
          w="3px"
          borderTopRightRadius="full"
          borderBottomRightRadius="full"
          bg={
            // eslint-disable-next-line no-nested-ternary
            isSelected
              ? 'interactive-default'
              : isHovered
              ? 'icon-subdued'
              : 'transparent'
          }
        />
        <WalletAvatar {...rest} circular={isSelected} />
      </HStack>
    )}
  </Pressable>
);

const WalletItemDefaultProps = {
  isSelected: false,
  decorationColor: 'surface-neutral-default',
} as const;

WalletItem.defaultProps = WalletItemDefaultProps;
type LeftSideProps = {
  selectedWallet?: Wallet | null;
  setSelectedWallet: (v: Wallet) => void;
};

const LeftSide: FC<LeftSideProps> = ({ selectedWallet, setSelectedWallet }) => {
  // const navigation = useNavigation<NavigationProps['navigation']>();
  const navigation = useAppNavigation();

  const { wallets } = useRuntime();

  const importedWallet = wallets.filter((w) => w.type === 'imported')[0];

  const { bottom } = useSafeAreaInsets();

  return (
    <VStack borderRightWidth={1} borderRightColor="border-subdued" pb={bottom}>
      <ScrollView>
        <VStack py={2}>
          {/* APP Wallet */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hd')
              .map((wallet, index) => (
                <WalletItem
                  key={`${wallet.id}${index}`}
                  onPress={() => {
                    setHaptics();
                    setSelectedWallet(wallet);
                  }}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage="hd"
                  avatar={wallet.avatar}
                />
              ))}
            {wallets.some((wallet) => wallet.type === 'hd') && <Box h={4} />}
          </VStack>
          {/* Hardware Wallet */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hw')
              .map((wallet, index) => (
                <WalletItem
                  key={`${wallet.id}${index}`}
                  onPress={() => {
                    setHaptics();
                    setSelectedWallet(wallet);
                  }}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage={wallet.type}
                  avatar={wallet.avatar}
                  walletType="hw"
                  hwWalletType={getDeviceTypeByDeviceId(
                    wallet.associatedDevice,
                  )}
                />
              ))}
          </VStack>
          {wallets.some((wallet) => wallet.type === 'hw') && <Box h={4} />}
          {/* Imported or watched wallet */}
          <VStack space={2}>
            {importedWallet ? (
              <WalletItem
                onPress={() => {
                  setHaptics();
                  setSelectedWallet(importedWallet);
                }}
                isSelected={selectedWallet?.id === importedWallet.id}
                walletImage="imported"
              />
            ) : null}

            {wallets
              .filter((wallet) => wallet.type === 'watching')
              .map((wallet) => (
                <WalletItem
                  key={wallet.id}
                  onPress={() => {
                    setHaptics();
                    setSelectedWallet(wallet);
                  }}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage="watching"
                />
              ))}
          </VStack>
        </VStack>
      </ScrollView>
      <Box p={2}>
        <IconButton
          type="primary"
          name="PlusOutline"
          circle
          size="xl"
          onPress={() =>
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.GuideModal,
              },
            })
          }
        />
      </Box>
    </VStack>
  );
};

export default LeftSide;
