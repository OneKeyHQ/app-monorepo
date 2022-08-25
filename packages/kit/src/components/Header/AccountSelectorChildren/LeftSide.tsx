import React, { ComponentProps, FC, memo, useMemo } from 'react';

import {
  Box,
  HStack,
  IconButton,
  Pressable,
  ScrollView,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from '@onekeyhq/engine/src/types/wallet';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { getDeviceTypeByDeviceId } from '../../../utils/hardware';
import WalletAvatar from '../WalletAvatar';

import type { AccountType, DeviceStatusType } from './index';

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
        <WalletAvatar {...rest} circular={!isSelected} />
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
  deviceStatus?: Record<string, DeviceStatusType | undefined>;
};

const LeftSide: FC<LeftSideProps> = ({
  selectedWallet,
  setSelectedWallet,
  deviceStatus,
}) => {
  const navigation = useAppNavigation();

  const { wallets } = useRuntime();

  const singletonWallet = useMemo(() => {
    const imported = wallets.filter(
      (w) => w.type === WALLET_TYPE_IMPORTED,
    )?.[0];
    const watching = wallets.filter(
      (w) => w.type === WALLET_TYPE_WATCHING,
    )?.[0];
    const external = wallets.filter(
      (w) => w.type === WALLET_TYPE_EXTERNAL,
    )?.[0];
    return {
      imported,
      watching,
      external,
    };
  }, [wallets]);

  const { bottom } = useSafeAreaInsets();

  const convertDeviceStatus = (status: DeviceStatusType | undefined) => {
    if (!status) return undefined;
    if (status?.isConnected) return 'connected';
    if (status?.hasUpgrade) return 'warning';
    return undefined;
  };

  return (
    <VStack
      testID="AccountSelectorChildren-LeftSide"
      borderRightWidth={1}
      borderRightColor="border-subdued"
      pb={`${bottom}px`}
    >
      <ScrollView>
        <VStack py={2}>
          {/* All APP HD Wallets */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hd')
              .map((wallet, index) => (
                <WalletItem
                  key={`${wallet.id}${index}`}
                  onPress={() => {
                    setSelectedWallet(wallet);
                  }}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage="hd"
                  avatar={wallet.avatar}
                />
              ))}
            {wallets.some((wallet) => wallet.type === 'hd') && <Box h={4} />}
          </VStack>
          {/* All Hardware Wallets */}
          <VStack space={2}>
            {wallets
              .filter((wallet) => wallet.type === 'hw')
              .map((wallet, index) => (
                <WalletItem
                  key={`${wallet.id}${index}`}
                  onPress={() => {
                    setSelectedWallet(wallet);
                  }}
                  isSelected={selectedWallet?.id === wallet.id}
                  walletImage={wallet.type}
                  avatar={wallet.avatar}
                  walletType="hw"
                  hwWalletType={
                    (wallet.deviceType as IOneKeyDeviceType) ||
                    getDeviceTypeByDeviceId(wallet.associatedDevice)
                  }
                  status={convertDeviceStatus(
                    deviceStatus?.[wallet.associatedDevice ?? ''],
                  )}
                />
              ))}
          </VStack>
          {wallets.some((wallet) => wallet.type === 'hw') && <Box h={4} />}
          {/* imported | watching | external  wallet */}
          <VStack space={2}>
            {singletonWallet.imported ? (
              <WalletItem
                onPress={() => {
                  setSelectedWallet(singletonWallet.imported);
                }}
                isSelected={selectedWallet?.id === singletonWallet.imported.id}
                walletImage="imported"
              />
            ) : null}

            {singletonWallet.watching ? (
              <WalletItem
                onPress={() => {
                  setSelectedWallet(singletonWallet.watching);
                }}
                isSelected={selectedWallet?.id === singletonWallet.watching.id}
                walletImage="watching"
              />
            ) : null}

            {singletonWallet.external ? (
              <WalletItem
                onPress={() => {
                  setSelectedWallet(singletonWallet.external);
                }}
                isSelected={selectedWallet?.id === singletonWallet.external.id}
                walletImage="external"
              />
            ) : null}
          </VStack>
        </VStack>
      </ScrollView>
      <Box p={2}>
        <IconButton
          testID="WalletAddOutline-Welcome"
          type="primary"
          name="WalletAddOutline"
          circle
          size="xl"
          onPress={() => {
            navigation.navigate(RootRoutes.Onboarding);
            // navigation.navigate(RootRoutes.Root, {
            //   screen: HomeRoutes.HomeOnboarding,
            // });
          }}
        />
      </Box>
    </VStack>
  );
};

export default memo(LeftSide);
