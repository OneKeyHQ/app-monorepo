/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useCallback, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';

import { SendRoutes, SendRoutesParams } from './types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

type EnableLocalAuthenticationProps = {
  sendParams: {
    accountId: string;
    networkId: string;
    to: string;
    value: string;
    tokenIdOnNetwork: string;
    gasLimit: string;
    gasPrice: string;
  };
  password: string;
};

const SendAuth: FC<EnableLocalAuthenticationProps> = ({
  sendParams,
  password,
}) => {
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation();

  const createTransfer = useCallback(async () => {
    const transferResult = await backgroundApiProxy.engine.transfer(
      password,
      sendParams.networkId,
      sendParams.accountId,
      sendParams.to,
      sendParams.value,
      sendParams.gasPrice,
      sendParams.gasLimit,
      sendParams.tokenIdOnNetwork,
    );

    return transferResult;
  }, [password, sendParams]);

  useEffect(() => {
    async function main() {
      const result = await createTransfer();
      console.log('-----result', result);

      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, createTransfer, dispatch]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const HDAccountAuthentication = () => {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const sendParams = {
    accountId: params.account.id,
    networkId: params.network.id,
    tokenIdOnNetwork: params.token.idOnNetwork,
    to: params.to,
    value: params.value,
    gasPrice: params.gasPrice,
    gasLimit: params.gasLimit,
  };
  return (
    <Modal footer={null}>
      <Protected>
        {(password) => <SendAuth sendParams={sendParams} password={password} />}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
