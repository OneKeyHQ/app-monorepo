import React, { FC, useEffect, useMemo } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';

import { Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  ManagerWalletModalRoutes,
  ManagerWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';

import ManagerWalletDeleteDialog from '../DeleteWallet';
import { ManagerType } from '../types';

type ManagerWalletAuthorityVerifyViewDoneProps = {
  password: string;
  walletId: string;
  managerType: ManagerType;
};

const ManagerWalletDialogAuthorityVerifyViewDone: FC<
  ManagerWalletAuthorityVerifyViewDoneProps
> = ({ password, walletId, managerType }) => {
  const navigation = useNavigation();

  const dialogs = useMemo(() => {
    if (!password) return null;

    switch (managerType) {
      case 'deleteWallet':
        return (
          <ManagerWalletDeleteDialog
            walletId={walletId}
            password={password}
            onDialogClose={() => {
              navigation?.getParent()?.goBack();
            }}
          />
        );

      default:
        return null;
    }
  }, [managerType, navigation, password, walletId]);

  return <>{dialogs}</>;
};

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal
>;

const ManagerWalletDialogAuthorityVerifyView: FC = () => {
  const { walletId, managerType } = useRoute<RouteProps>().params;

  const [inputPassword, setInputPassword] = React.useState('');

  type PasswordViewProps = {
    password: string;
  };
  const PasswordView: FC<PasswordViewProps> = ({ password }) => {
    useEffect(() => {
      setInputPassword(password);
    }, [password]);

    return (
      <Center w="full" h="full">
        <Spinner size="lg" />
      </Center>
    );
  };

  return (
    <>
      {!inputPassword && (
        <Modal footer={null}>
          <Protected>
            {(password) => <PasswordView password={password} />}
          </Protected>
        </Modal>
      )}
      {!!inputPassword && (
        <ManagerWalletDialogAuthorityVerifyViewDone
          walletId={walletId}
          password={inputPassword}
          managerType={managerType}
        />
      )}
    </>
  );
};

export default ManagerWalletDialogAuthorityVerifyView;
