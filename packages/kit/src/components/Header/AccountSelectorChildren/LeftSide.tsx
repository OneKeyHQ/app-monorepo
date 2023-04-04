import type { ComponentProps, FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  Box,
  Center,
  HStack,
  Icon,
  IconButton,
  Pressable,
  ScrollView,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import { useAppSelector, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { getDeviceTypeByDeviceId } from '../../../utils/hardware';
import { showDialog } from '../../../utils/overlayUtils';
import CreateHwWalletDialog from '../../../views/CreateWallet/HardwareWallet/CreateHwWalletDialog';
import WalletAvatar from '../../WalletSelector/WalletAvatar';

import type { AccountType, DeviceStatusType } from './index';

const convertDeviceStatus = (status: DeviceStatusType | undefined) => {
  if (!status) return undefined;
  if (status?.isConnected && status?.hasUpgrade) return 'upgrade';
  if (status?.isConnected) return 'connected';
  return undefined;
};

type HwWalletGroupType = {
  deviceId: string;

  wallets: Wallet[];
};

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

type HwWalletGroupProps = {
  index: number;
  walletGroup: HwWalletGroupType;
  selectedWallet?: Wallet | null;
  setSelectedWallet: (v: Wallet) => void;
  deviceStatus?: Record<string, DeviceStatusType | undefined>;
  onAddPassphraseWallet?: (deviceId: string) => void;
};

const HwWalletGroup: FC<HwWalletGroupProps> = ({
  index,
  walletGroup,
  selectedWallet,
  setSelectedWallet,
  deviceStatus,
  onAddPassphraseWallet,
}) => {
  const passphraseOpenedList = useAppSelector(
    (state) => state.hardware.passphraseOpened,
  );
  const [existsSelectedWallet, setExistsSelectedWallet] = useState(false);

  useEffect(() => {
    setExistsSelectedWallet(
      !!walletGroup.wallets.find((w) => w.id === selectedWallet?.id),
    );
  }, [selectedWallet, walletGroup]);

  const passphraseMode = useMemo(() => {
    if (passphraseOpenedList.find((v) => v === walletGroup.deviceId)) {
      return true;
    }
    // walletGroup.wallets=[ normalWallet, ...hiddenWallets ]
    if (walletGroup.wallets.find((w) => isPassphraseWallet(w))) {
      return true;
    }
    return false;
  }, [walletGroup, passphraseOpenedList]);

  const isGroup = useMemo(
    () => walletGroup.wallets.length > 1 || passphraseMode,
    [walletGroup, passphraseMode],
  );

  const getWalletItemStatus = useCallback(
    (wallet: Wallet, walletIndex: number) => {
      const status = convertDeviceStatus(
        deviceStatus?.[wallet.associatedDevice ?? ''],
      );

      if (existsSelectedWallet && selectedWallet?.id === wallet.id) {
        return status;
      }
      if (!existsSelectedWallet && walletIndex === 0) {
        return status;
      }

      return undefined;
    },
    [deviceStatus, existsSelectedWallet, selectedWallet?.id],
  );

  return (
    <Box>
      {isGroup && (
        <Box
          style={{
            position: 'absolute',
            top: -3,
            left: 5,
            bottom: -3,
            right: 5,
          }}
          rounded={16}
          borderWidth={1}
          borderColor="divider"
        />
      )}
      <VStack space={2}>
        {walletGroup.wallets.map((wallet, childIndex) => (
          <WalletItem
            key={`${wallet.id}${index}${childIndex}`}
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
            status={getWalletItemStatus(wallet, childIndex)}
            isPassphrase={!!wallet.passphraseState}
          />
        ))}
        {!!passphraseMode && onAddPassphraseWallet && (
          <Center>
            <Pressable
              justifyContent="center"
              alignItems="center"
              p="12px"
              rounded="12px"
              _hover={{ bgColor: 'surface-hovered' }}
              _pressed={{ bgColor: 'surface-pressed' }}
              onPress={() => {
                onAddPassphraseWallet?.(walletGroup.deviceId);
              }}
            >
              <Box>
                <Icon name="PlusOutline" size={24} />
              </Box>
            </Pressable>
          </Center>
        )}
      </VStack>
    </Box>
  );
};

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
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useAppNavigation();

  const { wallets } = useRuntime();
  const [hwWallet, setHwWallet] = useState<Array<HwWalletGroupType>>([]);

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

  useEffect(() => {
    const hwWallets = wallets.filter(
      (w) => w.type === WALLET_TYPE_HW && w.associatedDevice,
    );
    const walletRecord = hwWallets.reduce((result, w) => {
      const key = w.associatedDevice ?? '';
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(w);
      return result;
    }, {} as Record<string, Wallet[]>);

    // sort by device id
    const hwGroup: HwWalletGroupType[] = [];
    Object.keys(walletRecord).forEach((key) => {
      const value = walletRecord[key];
      const normal = value.find((w) => !w.passphraseState);
      const sortWallet = value.filter((w) => w.passphraseState);

      if (normal) sortWallet.unshift(normal);

      hwGroup.push({
        deviceId: key,
        wallets: sortWallet,
      });
    });

    setHwWallet(hwGroup);
  }, [wallets]);

  const onAddPassphraseWallet = useCallback((deviceId: string) => {
    showDialog(<CreateHwWalletDialog deviceId={deviceId} onlyPassphrase />);
  }, []);

  return (
    <VStack
      testID="AccountSelectorChildren-LeftSide"
      borderRightWidth={1}
      borderRightColor="border-subdued"
      pb={`${isVerticalLayout ? bottom : 0}px`}
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
            {hwWallet.map((wallet, index) => (
              <HwWalletGroup
                key={`${index}`}
                index={index}
                walletGroup={wallet}
                selectedWallet={selectedWallet}
                setSelectedWallet={setSelectedWallet}
                deviceStatus={deviceStatus}
                onAddPassphraseWallet={onAddPassphraseWallet}
              />
            ))}
          </VStack>
          {wallets.some((wallet) => wallet.type === 'hw') && <Box h={6} />}
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
      <Box py={2} px="7px">
        <IconButton
          testID="WalletAddOutline-Welcome"
          type="primary"
          name="WalletAddOutline"
          circle
          size="xl"
          onPress={() => {
            navigation.navigate(RootRoutes.Onboarding);
          }}
        />
      </Box>
    </VStack>
  );
};

export default memo(LeftSide);
