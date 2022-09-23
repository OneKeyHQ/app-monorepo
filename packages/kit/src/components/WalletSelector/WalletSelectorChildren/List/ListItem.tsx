import React, { useLayoutEffect } from 'react';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { IWallet } from '@onekeyhq/engine/src/types';
import { WalletAvatarPro } from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
    left={platformEnv.isNativeAndroid ? 0 : '-8px'}
    top="8px"
    bottom="8px"
    w="3px"
    bgColor="interactive-default"
    roundedRight="full"
    zIndex={9999}
  />
);

function RightContent({
  wallet,
  isSingleton,
  isSelected,
  deviceStatus,
}: IWalletDataBase & {
  isSelected: boolean;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
}) {
  return (
    <>
      {isSingleton ? null : (
        <>
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
  isLastItem,
  deviceStatus,
  onLastItemRender,
}: {
  wallet: IWallet;
  isSingleton?: boolean;
  isLastItem?: boolean;
  deviceStatus: IHardwareDeviceStatusMap | undefined;
  onLastItemRender?: () => void;
}) {
  const { walletId } = useActiveWalletAccount();
  // const deviceId = wallet.associatedDevice || '';
  const { dispatch, serviceAccount } = backgroundApiProxy;
  const isVertical = useIsVerticalLayout();
  const { closeWalletSelector } = useNavigationActions();
  const name = useWalletName({ wallet });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const numberOfAccounts = wallet.accounts.length;
  const isSelected = walletId === wallet.id;
  const circular = !isSelected;

  useLayoutEffect(() => {
    if (isLastItem) {
      onLastItemRender?.();
    }
  }, [isLastItem, onLastItemRender]);

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
        size={platformEnv.isNative ? 'lg' : 'sm'}
        circular={circular}
        wallet={wallet}
        deviceStatus={deviceStatus}
      />

      <Text
        flex={1}
        mx={3}
        typography={platformEnv.isNative ? 'Body1Strong' : 'Body2Strong'}
        isTruncated
      >
        {name}
      </Text>
      <RightContent
        wallet={wallet}
        isSingleton={isSingleton}
        isSelected={isSelected}
        deviceStatus={deviceStatus}
      />
      {isSelected ? <SelectedIndicator /> : undefined}
    </Pressable>
  );
}

function ListItemWithEmptyWallet({
  wallet,
  isSingleton,
  isLastItem,
  deviceStatus,
  onLastItemRender,
}: IWalletDataBase & {
  deviceStatus: IHardwareDeviceStatusMap | undefined;
  onLastItemRender?: () => void;
}) {
  if (!wallet) {
    return null;
  }
  return (
    <ListItem
      onLastItemRender={onLastItemRender}
      deviceStatus={deviceStatus}
      wallet={wallet}
      isSingleton={isSingleton}
      isLastItem={isLastItem}
    />
  );
}

export default ListItemWithEmptyWallet;
