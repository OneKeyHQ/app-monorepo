import React from 'react';

import {
  Badge,
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import { WalletAvatarPro } from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigationActions,
} from '../../../../hooks';
import { useWalletName } from '../../../../hooks/useWalletName';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { wait } from '../../../../utils/helper';
import {
  ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY,
  WALLET_SELECTOR_DESKTOP_ACTION_DELAY_AFTER_CLOSE,
} from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { WalletItemSelectDropdown } from '../WalletItemSelectDropdown';

import type { IHardwareDeviceStatusMap } from '../../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { IWalletDataBase } from './index';

const SelectedIndicator = () => (
  <Box
    position="absolute"
    left="-8px"
    top="8px"
    h="48px"
    w="3px"
    bgColor="interactive-default"
    roundedRight="full"
  />
);

function RightContent({
  wallet,
  isSingleton,
  numberOfAccounts,
  isSelected,
  deviceStatus,
}: IWalletDataBase & {
  isSelected: boolean;
  numberOfAccounts: number;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  const numberBadge = (
    <Badge title={String(numberOfAccounts || 0)} size="sm" mr={2} />
  );
  return (
    <>
      {isSingleton ? (
        numberBadge
      ) : (
        <>
          {numberBadge}
          {wallet ? (
            <WalletItemSelectDropdown
              wallet={wallet}
              deviceStatus={deviceStatus}
            />
          ) : null}
        </>
      )}
      {isSelected ? <SelectedIndicator /> : undefined}
    </>
  );
}

const { updateIsRefreshDisabled, updateIsLoading } =
  reducerAccountSelector.actions;

function ListItem({
  wallet,
  isSingleton,
  deviceStatus,
}: {
  wallet: IWallet;
  isSingleton?: boolean;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  const { walletId } = useActiveWalletAccount();
  // const deviceId = wallet.associatedDevice || '';
  const { dispatch, serviceAccount } = backgroundApiProxy;
  const isVertical = useIsVerticalLayout();
  const { closeWalletSelector } = useNavigationActions();
  const name = useWalletName({ wallet });

  const numberOfAccounts = wallet.accounts.length;
  const isSelected = walletId === wallet.id;
  const circular = !isSelected;

  return (
    <Pressable
      p={2}
      flexDirection="row"
      alignItems="center"
      rounded="2xl"
      // bgColor={selectedBgColor}
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      onPress={() => {
        closeWalletSelector();

        setTimeout(async () => {
          try {
            dispatch(updateIsRefreshDisabled(true), updateIsLoading(true));

            if (isVertical) {
              await wait(ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY);
            } else {
              await wait(WALLET_SELECTOR_DESKTOP_ACTION_DELAY_AFTER_CLOSE);
            }

            // await serviceNetwork.changeActiveNetwork(section?.title?.id);
            // TODO performance
            await serviceAccount.autoChangeAccount({
              walletId: wallet?.id ?? '',
            });
            // await serviceAccountSelector.setSelectedWalletToActive();
          } finally {
            await wait(100);
            dispatch(updateIsRefreshDisabled(false), updateIsLoading(false));
          }
        });
      }}
    >
      <WalletAvatarPro
        size="lg"
        circular={circular}
        wallet={wallet}
        deviceStatus={deviceStatus}
      />

      <Text flex={1} mx={3} typography="Body1Strong" isTruncated>
        {name}
      </Text>
      <RightContent
        wallet={wallet}
        isSingleton={isSingleton}
        isSelected={isSelected}
        numberOfAccounts={numberOfAccounts}
        deviceStatus={deviceStatus}
      />
      {isSelected ? <SelectedIndicator /> : undefined}
    </Pressable>
  );
}

function ListItemWithEmptyWallet({
  wallet,
  isSingleton,
  deviceStatus,
}: IWalletDataBase & {
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  if (!wallet) {
    return null;
  }
  return (
    <ListItem
      deviceStatus={deviceStatus}
      wallet={wallet}
      isSingleton={isSingleton}
    />
  );
}

export default ListItemWithEmptyWallet;
