/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useCallback, useEffect, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  changeActiveAccount,
  changeActiveNetwork,
} from '@onekeyhq/kit/src/store/reducers/general';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

type EnableLocalAuthenticationProps = {
  password: string;
  walletId: string;
  name: string;
  network: string;
};

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.CreateAccountAuthentication
>;

const HDAccountAuthenticationDone: FC<EnableLocalAuthenticationProps> = ({
  walletId,
  network,
  name,
  password,
}) => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const wallets = useAppSelector((s) => s.wallet.wallets);
  const networks = useAppSelector((s) => s.network.network);

  const wallet = useMemo(
    () => wallets.find((w) => w.id === walletId) ?? null,
    [walletId],
  );
  const selectedNetwork = useMemo(
    () => networks?.find((n) => n.id === network) ?? null,
    [network],
  );

  const createHDAccount = useCallback(async () => {
    const account = await engine.addHDAccount(
      password,
      walletId,
      network,
      undefined,
      name,
    );

    return account;
  }, [password, walletId, network, name]);

  useEffect(() => {
    async function main() {
      const account = await createHDAccount();

      dispatch(setRefreshTS());

      setTimeout(() => {
        dispatch(
          changeActiveAccount({
            account,
            wallet,
          }),
        );
        if (selectedNetwork) {
          dispatch(
            changeActiveNetwork({
              network: selectedNetwork,
              sharedChainName: selectedNetwork.impl,
            }),
          );
        }
      }, 50);

      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, createHDAccount, dispatch, wallet, selectedNetwork]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const HDAccountAuthentication = () => {
  const route = useRoute<RouteProps>();

  const { walletId, name, network } = route.params;

  return (
    <Modal footer={null}>
      <Protected>
        {(password) => (
          <HDAccountAuthenticationDone
            walletId={walletId}
            name={name}
            network={network}
            password={password}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
