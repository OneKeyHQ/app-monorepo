import React, { ComponentProps, FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Center,
  Divider,
  HStack,
  Icon,
  IconButton,
  Image,
  Pressable,
  ScrollView,
  Typography,
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

import type { AccountType } from './index';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type WalletItemProps = {
  isSelected?: boolean;
  decorationColor?: string;
  walletType?: AccountType;
  emoji?: string;
  deviceIconUrl?: string;
} & ComponentProps<typeof Pressable>;

const WalletItem: FC<WalletItemProps> = ({
  isSelected,
  decorationColor,
  walletType,
  emoji,
  deviceIconUrl,
  ...rest
}) => (
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
        <Box
          w={12}
          h={12}
          bg={decorationColor}
          borderRadius={isSelected ? 'xl' : 'full'}
          alignItems="center"
          justifyContent="center"
        >
          {walletType === 'hd' && (
            <Typography.DisplayLarge>{emoji && emoji}</Typography.DisplayLarge>
          )}
          {walletType === 'hw' && (
            <Image width="22px" height="32px" source={{ uri: deviceIconUrl }} />
          )}
          {walletType === 'imported' && <Icon name="SaveOutline" />}
          {walletType === 'watching' && <Icon name="EyeOutline" />}
        </Box>
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
  const navigation = useNavigation<NavigationProps['navigation']>();
  const wallets = useAppSelector((s) => s.wallet.wallets);
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
                  decorationColor="#FFF7D7"
                  walletType="hd"
                  emoji="🌈"
                />
              ))}

            {wallets.some((wallet) => wallet.type === 'hd') && (
              <Center pt={2} pb={4}>
                <Divider bgColor="border-default" w={6} />
              </Center>
            )}
          </VStack>
          {/* Hardware Wallet */}
          {/* <VStack space={2}>
            <WalletItem
              onPress={() => setActiveAccountType('hd')}
              isSelected={activeAccountType === 'hd'}
              decorationColor="#FFE0DF"
              walletType="hd"
              deviceIconUrl={MiniDeviceIcon}
            />
            <Center pt={2} pb={4}>
              <Divider bgColor="border-default" w={6} />
            </Center>
          </VStack> */}
          {/* Imported or watched wallet */}
          <VStack space={2}>
            {/* <WalletItem
              onPress={() => setActiveAccountType('imported')}
              isSelected={activeAccountType === 'imported'}
              walletType="imported"
            /> */}

            {wallets
              .filter((wallet) => wallet.type === 'watching')
              .map((wallet) => (
                <WalletItem
                  key={wallet.id}
                  onPress={() => setSelectedWallet(wallet)}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletType="watching"
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
                screen: CreateWalletModalRoutes.CreateWalletModal,
              },
            })
          }
        />
      </Box>
    </VStack>
  );
};

export default LeftSide;
