/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useCallback, useEffect } from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useDisableNavigationAnimation } from '../../hooks/useDisableNavigationAnimation';

import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendRoutes, SendRoutesParams } from './types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendAuthentication>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SendAuthentication
>;
type EnableLocalAuthenticationProps = {
  password: string;
};

const SendAuth: FC<EnableLocalAuthenticationProps> = ({ password }) => {
  const navigation = useNavigation<NavigationProps>();
  const toast = useToast();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { dispatch } = backgroundApiProxy;
  const { networkId, accountId, onSuccess, encodedTx, unsignedMessage } =
    route.params;

  const sendTx = useCallback(async () => {
    debugLogger.sendTx('Authentication sendTx:', route.params);
    // TODO needs wait rpc call finished, close Modal will cause tx send fail
    const result = await backgroundApiProxy.engine.signAndSendEncodedTx({
      password,
      networkId,
      accountId,
      encodedTx,
    });
    debugLogger.sendTx('Authentication sendTx DONE:', route.params, result);
    return result;
  }, [password]);
  const signMsg = useCallback(async () => {
    // TODO accountId check if equals to unsignedMessage
    const result = await backgroundApiProxy.engine.signMessage({
      password,
      networkId,
      accountId,
      unsignedMessage,
    });
    return result;
  }, []);

  useEffect(() => {
    async function main() {
      try {
        let result: any;
        if (encodedTx) {
          result = await sendTx();
        }
        if (unsignedMessage) {
          result = await signMsg();
          console.log('>>>>>>>> unsignedMessage ', unsignedMessage, result);
        }
        if (result) {
          onSuccess?.(result);
          if (navigation.canGoBack()) {
            // onSuccess will close() modal, goBack() is NOT needed here.
            // navigation.getParent()?.goBack?.();
          }
          const msg = intl.formatMessage({ id: 'transaction__success' });
          toast.show({
            title: msg,
          });
        }
      } catch (e) {
        console.error(e);
        if (route.params.backRouteName) {
          navigation.navigate({
            merge: true,
            name: route.params.backRouteName,
            params: route.params,
          });
        } else {
          // goBack or close
          navigation.getParent()?.goBack?.();
        }

        // EIP 1559 fail:
        //  replacement transaction underpriced
        //  already known
        setTimeout(() => {
          const error = e as OneKeyError;
          // TODO: better error displaying
          if (
            error?.code === -32603 &&
            typeof error?.data?.message === 'string'
          ) {
            toast.show({
              title:
                error.data.message ||
                intl.formatMessage({ id: 'transaction__failed' }),
              description: error.data.message, // TODO toast description not working
            });
          } else {
            const msg = error?.key
              ? intl.formatMessage({ id: error?.key as any }, error?.info ?? {})
              : error?.message ?? '';
            toast.show({
              title: msg || intl.formatMessage({ id: 'transaction__failed' }),
              description: msg,
            });
          }
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
  const { walletId } = params;

  useDisableNavigationAnimation({
    condition: !!params.autoConfirmAfterFeeSaved,
  });

  // TODO all Modal close should reject dapp call
  return (
    <Modal height="598px" footer={null}>
      <DecodeTxButtonTest encodedTx={params.encodedTx} />
      <Protected walletId={walletId} field={ValidationFields.Payment}>
        {(password) => <SendAuth password={password} />}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
