/* eslint-disable no-nested-ternary */
import React, { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import {
  Box,
  Pressable,
  Skeleton,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigationActions,
} from '../../../../hooks';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useNativeTokenBalance } from '../../../../hooks/useTokens';
import {
  ModalRoutes,
  RootRoutes,
  SendRoutes,
} from '../../../../routes/routesEnum';
import reducerAccountSelector, {
  EAccountSelectorMode,
} from '../../../../store/reducers/reducerAccountSelector';
import { wait } from '../../../../utils/helper';
import { formatAmount } from '../../../../utils/priceUtils';
import ExternalAccountImg from '../../../../views/ExternalAccount/components/ExternalAccountImg';
import { ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { AccountItemSelectDropdown } from '../AccountItemSelectDropdown';

type ListItemProps = {
  label?: string;
  address?: string;
  balance?: string;
  account: IAccount;
  wallet: IWallet;
  network: INetwork | null | undefined;
  networkId: string | undefined;
  walletId: string | undefined;
  onLastItemRender?: () => void;
};

const defaultProps = {} as const;

const { updateIsRefreshDisabled } = reducerAccountSelector.actions;
const ListItem: FC<ListItemProps> = ({
  account,
  network,
  label,
  address,
  // balance,
  networkId,
  walletId,
  wallet,
  onLastItemRender,
}) => {
  const { dispatch, serviceNetwork, serviceAccount, serviceAccountSelector } =
    backgroundApiProxy;
  const isVertical = useIsVerticalLayout();
  const closeModal = useModalClose();
  const { closeWalletSelector } = useNavigationActions();
  const navigation = useAppNavigation();
  const accountSelectorMode = useAppSelector(
    (s) => s.accountSelector.accountSelectorMode,
  );

  const nativeBalance = useNativeTokenBalance(network?.id, account.id);

  // @ts-ignore
  const isLastItem = account?.$isLastItem;
  useLayoutEffect(() => {
    if (isLastItem) {
      onLastItemRender?.();
    }
  }, [isLastItem, onLastItemRender]);

  const {
    walletId: activeWalletId,
    accountId: activeAccountId,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const isActive = useMemo(
    () =>
      activeWalletId === walletId &&
      activeAccountId === account.id &&
      activeNetworkId === networkId,
    [
      activeWalletId,
      walletId,
      activeAccountId,
      account.id,
      activeNetworkId,
      networkId,
    ],
  );

  const onPress = useCallback(async () => {
    closeModal();
    closeWalletSelector();
    await wait(0);
    const accountId = account?.id || '';

    if (accountSelectorMode === EAccountSelectorMode.Transfer) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.PreSendToken,
          params: {
            accountId,
            networkId: networkId || '',
            from: '',
            to: '',
            amount: '',
          },
        },
      });
      return;
    }
    if (accountSelectorMode === EAccountSelectorMode.Wallet) {
      dispatch(updateIsRefreshDisabled(true));

      try {
        if (isVertical) {
          await wait(ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY);
        }

        if (networkId) {
          await serviceNetwork.changeActiveNetwork(networkId);
        }
        await serviceAccount.changeActiveAccount({
          accountId,
          walletId: walletId ?? '',
        });
        await serviceAccountSelector.setSelectedWalletToActive();
        appUIEventBus.emit(AppUIEventBusNames.AccountChanged);
      } finally {
        await wait(100);
        dispatch(updateIsRefreshDisabled(false));
      }
    }
  }, [
    account?.id,
    accountSelectorMode,
    closeModal,
    closeWalletSelector,
    dispatch,
    isVertical,
    navigation,
    networkId,
    serviceAccount,
    serviceAccountSelector,
    serviceNetwork,
    walletId,
  ]);

  return (
    <Pressable onPress={onPress}>
      {({ isHovered, isPressed }) => (
        <>
          <Box
            flexDirection="row"
            alignItems="center"
            p={2}
            pr={1.5}
            rounded="xl"
            bgColor={
              isActive
                ? 'surface-selected'
                : isPressed
                ? 'surface-pressed'
                : isHovered
                ? 'surface-hovered'
                : 'transparent'
            }
          >
            <ExternalAccountImg mr={2} accountId={account?.id} />
            <Box flex={1} mr={3}>
              <Text typography="Body2Strong" isTruncated numberOfLines={1}>
                {label}
              </Text>
              <Box flexDirection="row">
                <Text typography="Body2" color="text-subdued">
                  {address}
                </Text>
                <Box w={1} h={1} m={2} bgColor="icon-disabled" rounded="full" />
                {nativeBalance ? (
                  <>
                    <Text typography="Body2" color="text-subdued" isTruncated>
                      {formatAmount(nativeBalance, 6)}
                    </Text>
                    <Text typography="Body2" color="text-subdued" ml="2px">
                      {network?.symbol.toUpperCase()}
                    </Text>
                  </>
                ) : (
                  <Skeleton shape="Body2" />
                )}
              </Box>
            </Box>
            <AccountItemSelectDropdown
              // key={account?.id}
              wallet={wallet}
              account={account}
              network={network}
            />
          </Box>
        </>
      )}
    </Pressable>
  );
};

ListItem.defaultProps = defaultProps;

export default ListItem;
