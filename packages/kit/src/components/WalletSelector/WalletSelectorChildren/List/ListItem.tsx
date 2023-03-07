import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY,
  WALLET_SELECTOR_DESKTOP_ACTION_DELAY_AFTER_CLOSE,
} from '@onekeyhq/kit/src/components/Header/AccountSelectorChildren/accountSelectorConsts';
import type { IHardwareDeviceStatusMap } from '@onekeyhq/kit/src/components/NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { DeviceState } from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import {
  WalletAvatarPro,
  useHardwareWalletInfo,
} from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import {
  useActiveWalletAccount,
  useNavigationActions,
} from '@onekeyhq/kit/src/hooks';
import { useWalletName } from '@onekeyhq/kit/src/hooks/useWalletName';
import reducerAccountSelector from '@onekeyhq/kit/src/store/reducers/reducerAccountSelector';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletItemSelectDropdown } from '../WalletItemSelectDropdown';

import type { IWalletDataBase } from './index';

const SelectedIndicator = () => (
  <Box
    position="absolute"
    left="0"
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
  devicesStatus,
}: IWalletDataBase & {
  devicesStatus: IHardwareDeviceStatusMap | undefined;
}) {
  return (
    <>
      {isSingleton ? null : (
        <>
          {wallet ? (
            <WalletItemSelectDropdown
              wallet={wallet}
              devicesStatus={devicesStatus}
            />
          ) : null}
        </>
      )}
    </>
  );
}

const { updateIsRefreshDisabled, updateIsLoading } =
  reducerAccountSelector.actions;

export function ListItemBase({
  leftView,
  rightView,
  text,
  deviceState,
  onPress,
  isSelected,
}: {
  text: string | undefined;
  deviceState?: DeviceState;
  leftView?: any;
  rightView?: any;
  onPress?: () => void;
  isSelected?: boolean;
}) {
  const intl = useIntl();
  const [deviceStatusColor, setDeviceStatusColor] = useState('');
  const [deviceStatusContent, setDeviceStatusContent] = useState<
    string | undefined
  >();

  useEffect(() => {
    if (deviceState === 'connected') {
      setDeviceStatusColor('interactive-default');
      setDeviceStatusContent(
        intl.formatMessage({ 'id': 'msg__hardware_status_connected' }),
      );
    } else if (deviceState === 'upgrade') {
      setDeviceStatusColor('icon-highlight');
      setDeviceStatusContent(
        intl.formatMessage({ 'id': 'msg__hardware_status_update_available' }),
      );
    } else {
      setDeviceStatusContent(undefined);
    }
  }, [deviceState, intl]);

  return (
    <Box px={2}>
      <Pressable
        p={2}
        flexDirection="row"
        alignItems="center"
        rounded="2xl"
        // bgColor={selectedBgColor}
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
        onPress={onPress}
      >
        {leftView}
        <Box flex={1} mx={3}>
          <Text
            typography={platformEnv.isNative ? 'Body1Strong' : 'Body2Strong'}
            isTruncated
          >
            {text}
          </Text>
          {deviceStatusContent && (
            <Text
              typography="Body2"
              mt="4px"
              isTruncated
              color={deviceStatusColor}
            >
              {deviceStatusContent}
            </Text>
          )}
        </Box>
        {rightView}
      </Pressable>
      {isSelected ? <SelectedIndicator /> : undefined}
    </Box>
  );
}

function ListItem({
  wallet,
  isSingleton,
  isLastItem,
  devicesStatus,
  onLastItemRender,
}: {
  wallet: IWallet;
  isSingleton?: boolean; // isSingleton Wallet: watching\imported\external
  isLastItem?: boolean;
  devicesStatus: IHardwareDeviceStatusMap | undefined;
  onLastItemRender?: () => void;
}) {
  const { walletId } = useActiveWalletAccount();
  // const deviceId = wallet.associatedDevice || '';
  const { dispatch, serviceAccount } = backgroundApiProxy;
  const isVertical = useIsVerticalLayout();
  const { closeWalletSelector } = useNavigationActions();
  const name = useWalletName({ wallet });
  const hwInfo = useHardwareWalletInfo({
    devicesStatus,
    wallet,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const numberOfAccounts = wallet.accounts.length;
  const isSelected = walletId === wallet.id;
  const circular = !isSelected;

  useLayoutEffect(() => {
    if (isLastItem) {
      onLastItemRender?.();
    }
  }, [isLastItem, onLastItemRender]);

  const onPress = useCallback(() => {
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
          skipIfSameWallet: true,
        });
        // await serviceAccountSelector.setSelectedWalletToActive();
      } finally {
        await wait(100);
        dispatch(updateIsRefreshDisabled(false), updateIsLoading(false));
      }
    });
  }, [closeWalletSelector, dispatch, isVertical, serviceAccount, wallet?.id]);

  return (
    <ListItemBase
      deviceState={hwInfo.deviceStatus}
      onPress={onPress}
      leftView={
        <WalletAvatarPro
          size={platformEnv.isNative ? 'lg' : 'sm'}
          circular={circular}
          wallet={wallet}
          devicesStatus={undefined}
        />
      }
      rightView={
        <RightContent
          wallet={wallet}
          isSingleton={isSingleton}
          devicesStatus={devicesStatus}
        />
      }
      text={name}
      isSelected={isSelected}
    />
  );
}

function ListItemWithEmptyWallet({
  wallet,
  isSingleton,
  isLastItem,
  devicesStatus,
  onLastItemRender,
}: IWalletDataBase & {
  devicesStatus: IHardwareDeviceStatusMap | undefined;
  onLastItemRender?: () => void;
}) {
  if (!wallet) {
    return null;
  }
  return (
    <ListItem
      onLastItemRender={onLastItemRender}
      devicesStatus={devicesStatus}
      wallet={wallet}
      isSingleton={isSingleton}
      isLastItem={isLastItem}
    />
  );
}

export default ListItemWithEmptyWallet;
