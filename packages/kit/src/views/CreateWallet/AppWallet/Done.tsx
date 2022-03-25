import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../routes/types';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AppWalletDoneModal
>;

type DoneProps = {
  password: string;
  mnemonic?: string;
};

const Done: FC<DoneProps> = ({ password, mnemonic }) => {
  const { serviceApp } = backgroundApiProxy;
  const navigation = useNavigation();
  const appNavigation = useAppNavigation();
  useEffect(() => {
    async function main() {
      const wallet = await serviceApp.createHDWallet({ password, mnemonic });
      const inst = navigation.getParent() || navigation;
      setTimeout(() => {
        inst.goBack();
        appNavigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.BackupTipsModal,
            params: {
              walletId: wallet.id,
            },
          },
        });
      }, 100);
    }
    main();
  }, [navigation, password, serviceApp, mnemonic, appNavigation]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const AppWalletDone = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic } = route.params ?? {};
  return (
    <Modal footer={null}>
      <Protected>
        {(password) => <Done password={password} mnemonic={mnemonic} />}
      </Protected>
    </Modal>
  );
};

export default AppWalletDone;
