import React, { FC, memo, useCallback } from 'react';

import { DrawerActions } from '@react-navigation/native';
import { InteractionManager } from 'react-native';

import {
  Account,
  Box,
  DialogManager,
  HStack,
  Pressable,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ValidationFields } from '@onekeyhq/kit/src/components/Protected';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import useLocalAuthenticationModal from '@onekeyhq/kit/src/hooks/useLocalAuthenticationModal';
import { ManagerAccountModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerAccount';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import AccountModifyNameDialog from '@onekeyhq/kit/src/views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';

import { useCopyAddress } from '../../../../hooks/useCopyAddress';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { wait } from '../../../../utils/helper';
import ExternalAccountImg from '../../../WalletConnect/ExternalAccountImg';
import { ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY } from '../accountSelectorConsts';

import ItemActionButton from './ItemActionButton';

import type { SectionListData } from 'react-native';

export type AccountGroup = { title: Network; data: AccountEngineType[] };

type Props = {
  section: SectionListData<AccountEngineType, AccountGroup>;
  item: AccountEngineType;
  activeWallet: Wallet | null | undefined;
  activeNetwork: Network | null;
  activeAccount: AccountEngineType | null;
  refreshAccounts: (walletId: string, networkId: string) => void;
};

const { updateIsRefreshDisabled } = reducerAccountSelector.actions;

const AccountSectionItem: FC<Props> = ({
  section,
  item,
  activeWallet,
  activeNetwork,
  activeAccount,
  refreshAccounts,
}) => {
  const { serviceAccount, dispatch, serviceNetwork, serviceAccountSelector } =
    backgroundApiProxy;
  const navigation = useNavigation();

  const isVertical = useIsVerticalLayout();
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();

  const { copyAddress } = useCopyAddress({
    wallet: activeWallet,
    account: item,
    network: section.title,
  });

  const handleChange = useCallback(
    (value) => {
      switch (value) {
        case 'copy':
          copyAddress(item.displayAddress ?? item.address);
          break;
        case 'rename':
          DialogManager.show({
            render: (
              <AccountModifyNameDialog
                visible
                account={item}
                onDone={() =>
                  refreshAccounts(
                    activeWallet?.id ?? '',
                    activeNetwork?.id ?? '',
                  )
                }
              />
            ),
          });
          break;
        case 'detail':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManagerAccount,
            params: {
              screen: ManagerAccountModalRoutes.ManagerAccountModal,
              params: {
                walletId: activeWallet?.id ?? '',
                accountId: item.id,
                networkId: activeNetwork?.id ?? '',
                refreshAccounts: () =>
                  refreshAccounts(
                    activeWallet?.id ?? '',
                    activeNetwork?.id ?? '',
                  ),
              },
            },
          });
          break;
        case 'remove':
          // bypass password verify
          if (
            activeWallet?.type === 'watching' ||
            activeWallet?.type === 'external'
          ) {
            showRemoveAccountDialog(
              activeWallet?.id ?? '',
              item.id,
              undefined,
              () =>
                refreshAccounts(
                  activeWallet?.id ?? '',
                  activeNetwork?.id ?? '',
                ),
            );
          } else {
            showVerify(
              (pwd) => {
                showRemoveAccountDialog(
                  activeWallet?.id ?? '',
                  item.id,
                  pwd,
                  () =>
                    refreshAccounts(
                      activeWallet?.id ?? '',
                      activeNetwork?.id ?? '',
                    ),
                );
              },
              () => {},
              null,
              ValidationFields.Account,
            );
          }
          break;

        default:
          break;
      }
    },
    [
      copyAddress,
      item,
      navigation,
      activeWallet?.id,
      activeWallet?.type,
      activeNetwork?.id,
      refreshAccounts,
      showRemoveAccountDialog,
      showVerify,
    ],
  );

  return (
    <>
      <Pressable
        px={2}
        onPress={() => {
          navigation.dispatch(DrawerActions.closeDrawer());
          dispatch(updateIsRefreshDisabled(true));

          InteractionManager.runAfterInteractions(async () => {
            try {
              if (isVertical) {
                await wait(ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY);
              }

              await serviceNetwork.changeActiveNetwork(section?.title?.id);
              await serviceAccount.changeActiveAccount({
                accountId: item.id,
                walletId: activeWallet?.id ?? '',
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
          <HStack
            p="7px"
            borderWidth={1}
            borderColor={isHovered ? 'border-hovered' : 'transparent'}
            bgColor={isPressed ? 'surface-pressed' : undefined}
            borderStyle="dashed"
            bg={
              activeAccount?.id === item.id &&
              activeNetwork?.id === section?.title?.id
                ? 'surface-selected'
                : 'transparent'
            }
            borderRadius="xl"
            alignItems="center"
          >
            <ExternalAccountImg
              ml={1}
              mr={3}
              size={6}
              radius="6px"
              accountId={item.id}
            />
            <Box flex={1}>
              <Account
                hiddenAvatar
                address={item?.displayAddress ?? item?.address ?? ''}
                name={item.name}
              />
            </Box>
            <Box w={2} />
            <ItemActionButton
              type={activeWallet?.type}
              onChange={handleChange}
            />
          </HStack>
        )}
      </Pressable>
      {RemoveAccountDialog}
    </>
  );
};

export default memo(AccountSectionItem);
