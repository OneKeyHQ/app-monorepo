/* eslint-disable  @typescript-eslint/no-unused-vars */
import React, { ComponentProps, FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Center,
  Divider,
  HStack,
  IconButton,
  Pressable,
  ScrollView,
  VStack,
} from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import WalletAvatar from '../WalletAvatar';

import type { AccountType } from './index';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
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

  const wallets = useAppSelector((s) => s.wallet.wallets);

  const importedWallet = wallets.filter((w) => w.type === 'imported')[0];
  const watchingWallet = wallets.filter((w) => w.type === 'watching')[0];

  return (
    <VStack borderRightWidth={1} borderRightColor="border-subdued">
      <ScrollView>
        <VStack py={2}>
          {/* APP Wallet */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hd')
              .map((wallet) => (
                <WalletItem
                  key={wallet.id}
                  onPress={() => setSelectedWallet(wallet)}
                  isSelected={selectedWallet?.id === wallet.id}
                  avatarBgColor="#55A9D9"
                />
              ))}

            {wallets.some((wallet) => wallet.type === 'hd') && (
              <Center pt={2} pb={4}>
                <Divider bgColor="border-default" w={6} />
              </Center>
            )}
          </VStack>
          {/* Hardware Wallet */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hw')
              .map((wallet) => (
                <WalletItem
                  onPress={() => setSelectedWallet(wallet)}
                  isSelected={selectedWallet?.id === wallet.id}
                  avatarBgColor="#FFE0DF"
                  walletType="hw"
                />
              ))}

            {wallets.some((wallet) => wallet.type === 'hw') && (
              <Center pt={2} pb={4}>
                <Divider bgColor="border-default" w={6} />
              </Center>
            )}
          </VStack>
          {/* Imported or watched wallet */}
          <VStack space={2}>
            {importedWallet ? (
              <WalletItem
                onPress={() => setSelectedWallet(importedWallet)}
                isSelected={selectedWallet?.id === importedWallet.id}
                walletImage="imported"
              />
            ) : null}

            {wallets
              .filter((wallet) => wallet.type === 'watching')
              .map((wallet) => (
                <WalletItem
                  key={wallet.id}
                  onPress={() => setSelectedWallet(wallet)}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage="watched"
                />
              ))}
          </VStack>
        </VStack>
      </ScrollView>
      <Box p={2}>
        <IconButton
          type="plain"
          name="PlusOutline"
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
