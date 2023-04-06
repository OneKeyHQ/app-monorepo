import type { FC } from 'react';
import { memo, useCallback } from 'react';

import { InteractionManager } from 'react-native';

import {
  Account,
  Box,
  HStack,
  Pressable,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNavigation, useNavigationActions } from '@onekeyhq/kit/src/hooks';
import {
  ManagerAccountModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import AccountModifyNameDialog from '@onekeyhq/kit/src/views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';

import { useCopyAddress } from '../../../../hooks/useCopyAddress';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { wait } from '../../../../utils/helper';
import { showDialog } from '../../../../utils/overlayUtils';
import ExternalAccountImg from '../../../../views/ExternalAccount/components/ExternalAccountImg';
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
  const { goToRemoveAccount, RemoveAccountDialog } = useRemoveAccountDialog();
  const { closeWalletSelector } = useNavigationActions();

  const { copyAddress } = useCopyAddress({
    wallet: activeWallet,
    account: item,
    network: section.title,
  });

  const handleChange = useCallback(
    (value) => {
      switch (value) {
        case 'copy':
          copyAddress({
            address: item.address,
            displayAddress: item.displayAddress,
          });
          break;
        case 'rename':
          showDialog(
            <AccountModifyNameDialog
              visible
              account={item}
              onDone={() =>
                refreshAccounts(activeWallet?.id ?? '', activeNetwork?.id ?? '')
              }
            />,
          );
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
          goToRemoveAccount({
            wallet: activeWallet,
            accountId: item.id,
            networkId: activeNetwork?.id ?? '',
            callback: () =>
              refreshAccounts(activeWallet?.id ?? '', activeNetwork?.id ?? ''),
          });

          break;

        default:
          break;
      }
    },
    [
      copyAddress,
      item,
      navigation,
      activeWallet,
      activeNetwork?.id,
      goToRemoveAccount,
      refreshAccounts,
    ],
  );

  return (
    <>
      <Pressable
        px={2}
        onPress={() => {
          closeWalletSelector();
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
