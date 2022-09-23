/* eslint-disable no-nested-ternary */
import React, { FC, useLayoutEffect, useMemo } from 'react';

import { InteractionManager } from 'react-native';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigationActions,
} from '../../../../hooks';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { wait } from '../../../../utils/helper';
import { ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import ExternalAccountImg from '../../../WalletConnect/ExternalAccountImg';
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
  balance,
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

  return (
    <Pressable
      onPress={() => {
        closeModal();
        closeWalletSelector();
        dispatch(updateIsRefreshDisabled(true));

        InteractionManager.runAfterInteractions(async () => {
          try {
            if (isVertical) {
              await wait(ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY);
            }

            if (networkId) {
              await serviceNetwork.changeActiveNetwork(networkId);
            }
            await serviceAccount.changeActiveAccount({
              accountId: account.id,
              walletId: walletId ?? '',
            });
            await serviceAccountSelector.setSelectedWalletToActive();
          } finally {
            await wait(100);
            dispatch(updateIsRefreshDisabled(false));
          }
        });
      }}
    >
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
              <Text typography="Body2Strong">{label}</Text>
              <Box flexDirection="row">
                <Text typography="Body2" color="text-subdued">
                  {address}
                </Text>
                {balance ? (
                  <>
                    <Box
                      w={1}
                      h={1}
                      m={2}
                      bgColor="icon-disabled"
                      rounded="full"
                    />
                    <Text typography="Body2" color="text-subdued" isTruncated>
                      {balance}
                    </Text>
                  </>
                ) : null}
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
