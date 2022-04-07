/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useCallback, useEffect } from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { SendRoutes, SendRoutesParams } from './types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendAuthentication>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SendAuthentication
>;
type EnableLocalAuthenticationProps = {
  sendParams: {
    networkId: string;
    accountId: string;
    encodedTx: any;
  };
  password: string;
};

const SendAuth: FC<EnableLocalAuthenticationProps> = ({
  sendParams,
  password,
}) => {
  const navigation = useNavigation<NavigationProps>();
  const toast = useToast();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { dispatch } = backgroundApiProxy;

  const sendTx = useCallback(async () => {
    debugLogger.sendTx('Authentication sendTx:', sendParams);
    // TODO needs wait rpc call finished, close Modal will cause tx send fail
    const result = await backgroundApiProxy.engine.signAndSendEncodedTx({
      password,
      networkId: sendParams.networkId,
      accountId: sendParams.accountId,
      encodedTx: sendParams.encodedTx,
    });
    if (route.params.onSuccess) {
      route.params.onSuccess(result);
    }
    debugLogger.sendTx('Authentication sendTx DONE:', sendParams, result);
    return true;
  }, [password, sendParams]);

  useEffect(() => {
    async function main() {
      try {
        const result = await sendTx();
        if (result) {
          if (navigation.canGoBack()) {
            navigation.getParent()?.goBack?.();
          }
          // TODO toast not working if timeout < 500, and should be after navigate()
          setTimeout(() => {
            const msg = intl.formatMessage({ id: 'transaction__success' });
            toast.show({
              title: msg,
            });
          }, 600);
        }
      } catch (e) {
        // navigation.navigate({
        //   merge: true,
        //   // TODO custom back name, Back to Send/SendConfirm
        //   name: SendRoutes.Send,
        //   params: route.params,
        // });

        // EIP 1559 fail:
        //  replacement transaction underpriced
        //  already known
        setTimeout(() => {
          console.error(e);
          const error = e as { key?: string; message?: string };
          toast.show({
            title: error?.key ?? error?.message ?? '',
          });
        }, 600);
      }
    }
    main();
  }, [navigation, sendTx, dispatch]);
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
    networkId: params.networkId,
    accountId: params.accountId,
    encodedTx: params.encodedTx,
  };
  return (
    <Modal height="598px" footer={null}>
      <Protected>
        {(password) => <SendAuth sendParams={sendParams} password={password} />}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
