import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

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
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateAccount,
      params: {
        screen: CreateAccountModalRoutes.CreateAccountAuthentication,
        params: {
          walletId,
          onDone: (password) => {
            navigation.replace(
              CreateAccountModalRoutes.RecoverAccountsList as any,
              {
                walletId,
                network: networkId,
                password,
                purpose: '60',
                template: `m/44'/60'/0'/0/x`,
              },
            );
          },
        },
      },
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
    ],
    [onPressCreateAccount, onPressManageAccount],
  );

  return <BaseMenu options={options} {...props} />;
};

export default AccountSelectorWalletMenu;
