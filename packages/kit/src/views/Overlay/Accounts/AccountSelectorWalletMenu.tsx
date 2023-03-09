import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { Divider } from '@onekeyhq/components';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useCreateAccountInWallet } from '../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import { useNavigation } from '../../../hooks';
import {
  CreateAccountModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import BaseMenu from '../BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../BaseMenu';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

const AccountSelectorWalletMenu: FC<
  IMenu & { walletId: string; networkId: string | undefined }
> = (props) => {
  const { walletId, networkId } = props;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { createAccount } = useCreateAccountInWallet({
    networkId,
    walletId,
    isFromAccountSelector: true,
  });
  const onPressCreateAccount = useCallback(async () => {
    if (!walletId) return;
    await createAccount();
  }, [walletId, createAccount]);

  const onPressManageAccount = useCallback(() => {
    setTimeout(() => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateAccount,
        params: {
          screen: CreateAccountModalRoutes.CreateAccountAuthentication,
          params: {
            walletId,
            onDone: (password) => {
              setTimeout(() => {
                navigation.replace(
                  CreateAccountModalRoutes.RecoverAccountsList as any,
                  {
                    walletId,
                    network: networkId,
                    password,
                    purpose: '',
                    template: '',
                  },
                );
              }, 20);
            },
          },
        },
      });
    });
  }, [navigation, walletId, networkId]);

  const onPressBulkCopyAddresses = useCallback(() => {
    setTimeout(() => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateAccount,
        params: {
          screen: CreateAccountModalRoutes.CreateAccountAuthentication,
          params: {
            walletId,
            onDone: (password) => {
              setTimeout(() => {
                navigation.replace(
                  CreateAccountModalRoutes.BulkCopyAddresses as any,
                  {
                    walletId,
                    networkId,
                    password,
                  },
                );
              }, 20);
            },
          },
        },
      });
    });
  }, [navigation, walletId, networkId]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__add_account',
        onPress: onPressCreateAccount,
        icon: 'PlusMini',
      },
      {
        id: 'action__manage_account',
        onPress: onPressManageAccount,
        icon: 'SquaresPlusMini',
      },
      () => <Divider />,
      {
        id: 'title__bulk_copy_addresses',
        onPress: onPressBulkCopyAddresses,
        icon: 'TrashOutline',
      },
    ],
    [onPressCreateAccount, onPressManageAccount, onPressBulkCopyAddresses],
  );

  return (
    <BaseMenu
      options={options}
      {...props}
      menuWidth={platformEnv.isNative ? 200 : 190}
    />
  );
};

export default AccountSelectorWalletMenu;
