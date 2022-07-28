import React, { FC, useCallback, useEffect, useRef } from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { IEncodedTx, ISignedTx } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useDecodedTx, useInteractWithInfo } from '../../hooks/useDecodedTx';

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
  const submitted = useRef(false);
  const {
    networkId,
    accountId,
    encodedTx,
    onSuccess,
    unsignedMessage,
    payloadInfo,
    backRouteName,
    sourceInfo,
  } = route.params;
  const payload = payloadInfo || route.params.payload;

  const { decodedTx } = useDecodedTx({
    encodedTx,
    payload,
  });
  const interactInfo = useInteractWithInfo({ sourceInfo });

  const sendTx = useCallback(async () => {
    debugLogger.sendTx.info('Authentication sendTx:', route.params);
    // TODO needs wait rpc call finished, close Modal will cause tx send fail
    const result = await backgroundApiProxy.engine.signAndSendEncodedTx({
      password,
      networkId,
      accountId,
      encodedTx,
    });
    debugLogger.sendTx.info(
      'Authentication sendTx DONE:',
      route.params,
      result,
    );
    return result;
  }, [accountId, encodedTx, networkId, password, route.params]);

  const signMsg = useCallback(async () => {
    // TODO accountId check if equals to unsignedMessage
    const result = await backgroundApiProxy.engine.signMessage({
      password,
      networkId,
      accountId,
      unsignedMessage,
    });
    return result;
  }, [accountId, networkId, password, unsignedMessage]);

  const submit = useCallback(async () => {
    try {
      if (submitted.current) {
        return;
      }
      submitted.current = true;
      let submitEncodedTx: IEncodedTx | undefined = encodedTx;

      // throw new Error('test error');

      let result: any;
      let signedTx: ISignedTx | undefined;
      let signedMsg: string | undefined;
      if (submitEncodedTx) {
        signedTx = await sendTx();
        result = signedTx;
        // encodedTx will be edit by buildUnsignedTx, re-assign encodedTx
        submitEncodedTx = signedTx.encodedTx || submitEncodedTx;
      }
      if (unsignedMessage) {
        signedMsg = await signMsg();
        result = signedMsg;
        console.log('>>>>>>>> unsignedMessage ', unsignedMessage, signedMsg);
      }
      if (result) {
        onSuccess?.(result, {
          signedTx,
          encodedTx: submitEncodedTx,
          // should rebuild decodedTx from encodedTx,
          // as encodedTx will be edit by buildUnsignedTx
          decodedTx: submitEncodedTx
            ? (
                await backgroundApiProxy.engine.decodeTx({
                  networkId,
                  accountId,
                  encodedTx: submitEncodedTx,
                  payload,
                  interactInfo,
                })
              ).decodedTx
            : undefined,
        });
        if (navigation?.canGoBack?.()) {
          // onSuccess will close() modal, goBack() is NOT needed here.
          // navigation.getParent()?.goBack?.();
        }
      }
    } catch (e) {
      console.error(e);
      if (backRouteName) {
        // navigation.navigate(backRouteName);
        navigation.navigate({
          merge: true,
          name: backRouteName,
          // pass empty params, as backRouteName params format may be different
          params: {},
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
          toast.show(
            {
              title:
                error.data.message ||
                intl.formatMessage({ id: 'transaction__failed' }),
              description: error.data.message, // TODO toast description not working
            },
            { type: 'error' },
          );
        } else {
          const msg = error?.key
            ? intl.formatMessage({ id: error?.key as any }, error?.info ?? {})
            : error?.message ?? '';
          toast.show(
            {
              title: msg || intl.formatMessage({ id: 'transaction__failed' }),
              description: msg,
            },
            { type: 'error' },
          );
        }
      }, 600);
    }
  }, [
    accountId,
    backRouteName,
    encodedTx,
    interactInfo,
    intl,
    navigation,
    networkId,
    onSuccess,
    payload,
    sendTx,
    signMsg,
    toast,
    unsignedMessage,
  ]);

  useEffect(() => {
    if (decodedTx || unsignedMessage) {
      submit();
    }
  }, [decodedTx, unsignedMessage, submit]);
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
