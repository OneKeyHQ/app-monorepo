/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useCallback, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
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
  const navigation = useNavigation();
  const toast = useToast();
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;

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
      try {
        const result = await createTransfer();
        if (result?.success) {
          toast.show({
            title: intl.formatMessage({ id: 'transaction__success' }),
          });
          if (navigation.canGoBack()) {
            navigation.getParent()?.goBack?.();
          }
        }
      } catch (e) {
        const error = e as { key?: string; message?: string };
        toast.show({
          title: error?.key ?? error?.message ?? '',
        });
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
