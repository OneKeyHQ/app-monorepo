import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { cloneDeep, isString } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import { isExternalAccount } from '@onekeyhq/engine/src/engineUtils';
import {
  OneKeyError,
  OneKeyErrorClassNames,
} from '@onekeyhq/engine/src/errors';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IEncodedTx, ISignedTx } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useWalletConnectSendInfo } from '../../components/WalletConnect/useWalletConnectSendInfo';
import { useDecodedTx, useInteractWithInfo } from '../../hooks/useDecodedTx';
import { wait } from '../../utils/helper';

import { AuthExternalAccountInfo } from './AuthExternalAccountInfo';
import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendRoutes, SendRoutesParams } from './types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendAuthentication>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SendAuthentication
>;
type EnableLocalAuthenticationProps = {
  password: string;
  setTitleInfo: (titleInfo: ISendAuthenticationModalTitleInfo) => void;
};

const SendAuth: FC<EnableLocalAuthenticationProps> = ({
  password,
  setTitleInfo,
}) => {
  const navigation = useNavigation<NavigationProps>();
  const { validator } = backgroundApiProxy;
  const toast = useToast();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const submitted = useRef(false);
  const enableGoBack = useRef(true);
  const {
    networkId,
    accountId,
    encodedTx,
    onSuccess,
    onFail,
    unsignedMessage,
    payloadInfo,
    backRouteName,
    sourceInfo,
  } = route.params;
  const payload = payloadInfo || route.params.payload;
  const { getExternalConnector, externalAccountInfo } =
    useWalletConnectSendInfo({
      accountId,
      networkId,
    });

  const { decodedTx } = useDecodedTx({
    encodedTx,
    payload,
  });
  const interactInfo = useInteractWithInfo({ sourceInfo });
  const isExternal = useMemo(
    () => isExternalAccount({ accountId }),
    [accountId],
  );

  const sendTxForExternalAccount = useCallback(async () => {
    if (!encodedTx) {
      throw new Error('encodedTx is missing!');
    }
    const { connector } = await getExternalConnector();
    if (!connector) {
      return;
    }
    const txid = await connector.sendTransaction(encodedTx as IEncodedTxEvm);

    debugLogger.walletConnect.info(
      'sendTxForExternalAccount -> sendTransaction txid: ',
      txid,
    );
    if (txid && (await validator.isValidEvmTxid({ txid }))) {
      return {
        txid,
        rawTx: '',
        encodedTx,
      };
    }

    // BitKeep resolve('拒绝') but not reject(error)
    const errorMsg =
      txid && isString(txid)
        ? txid
        : intl.formatMessage({ id: 'msg__transaction_failed' });
    throw new Error(errorMsg);
  }, [encodedTx, validator, getExternalConnector, intl]);

  const signMsgForExternalAccount = useCallback(async () => {
    if (!unsignedMessage) {
      throw new Error('unsignedMessage is missing!');
    }
    const { connector } = await getExternalConnector();
    if (!connector) {
      return;
    }
    let result = '';
    const rawMesssage = unsignedMessage.payload;
    if (unsignedMessage.type === ETHMessageTypes.PERSONAL_SIGN) {
      result = await connector.signPersonalMessage(rawMesssage);
    } else if (unsignedMessage.type === ETHMessageTypes.ETH_SIGN) {
      result = await connector.signMessage(rawMesssage);
    } else {
      const typedDataMessage = cloneDeep(rawMesssage) as any[];
      if (
        unsignedMessage.type === ETHMessageTypes.TYPED_DATA_V3 ||
        unsignedMessage.type === ETHMessageTypes.TYPED_DATA_V4
      ) {
        const secondInfo = typedDataMessage?.[1];
        if (secondInfo && typeof secondInfo === 'string') {
          try {
            // do NOT need to JSON object
            // typedDataMessage[1] = JSON.parse(secondInfo);
          } catch (error) {
            debugLogger.common.error(error);
          }
        }
      }
      result = await connector.signTypedData(typedDataMessage);
    }
    return result;
  }, [unsignedMessage, getExternalConnector]);

  const sendTx = useCallback(async (): Promise<ISignedTx | undefined> => {
    if (isExternal) {
      return sendTxForExternalAccount();
    }

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
  }, [
    isExternal,
    route.params,
    password,
    networkId,
    accountId,
    encodedTx,
    sendTxForExternalAccount,
  ]);

  const signMsg = useCallback(async (): Promise<string | undefined> => {
    if (isExternal) {
      return signMsgForExternalAccount();
    }
    // TODO accountId check if equals to unsignedMessage
    const result = await backgroundApiProxy.engine.signMessage({
      password,
      networkId,
      accountId,
      unsignedMessage,
    });
    return result;
  }, [
    accountId,
    isExternal,
    networkId,
    password,
    signMsgForExternalAccount,
    unsignedMessage,
  ]);

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

        if (!signedTx) {
          return;
        }

        // encodedTx will be edit by buildUnsignedTx, re-assign encodedTx
        submitEncodedTx = signedTx.encodedTx || submitEncodedTx;
      }

      if (unsignedMessage) {
        signedMsg = await signMsg();
        result = signedMsg;
        if (!signedMsg) {
          return;
        }
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
      const error = e as OneKeyError;
      debugLogger.common.error(error);
      if (backRouteName) {
        // navigation.navigate(backRouteName);
        navigation.navigate({
          merge: true,
          name: backRouteName,
          // pass empty params, as backRouteName params format may be different
          params: {},
        });
      } else {
        /**
         * No need to goBack after component destroyed to avoid routing order confusion
         */
        if (!enableGoBack.current) return;
        // goBack or close
        navigation.getParent()?.goBack?.();
      }

      // needs delay to show toast
      await wait(600);

      // EIP 1559 fail:
      //  replacement transaction underpriced
      //  already known
      // TODO: better error displaying
      if (error?.code === -32603 && typeof error?.data?.message === 'string') {
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
        if (
          error.className !==
          OneKeyErrorClassNames.OneKeyWalletConnectModalCloseError
        ) {
          toast.show(
            {
              title: msg || intl.formatMessage({ id: 'transaction__failed' }),
              description: msg,
            },
            { type: 'error' },
          );
        }
      }

      await wait(100);
      // onFail() should be called after show toast, otherwise toast won't display
      onFail?.(error);
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
    onFail,
    payload,
    sendTx,
    signMsg,
    toast,
    unsignedMessage,
  ]);

  useEffect(
    () => () => {
      enableGoBack.current = false;
    },
    [enableGoBack],
  );
  useEffect(() => {
    if (decodedTx || unsignedMessage) {
      submit();
    }
  }, [decodedTx, unsignedMessage, submit]);
  return externalAccountInfo ? (
    <AuthExternalAccountInfo
      {...externalAccountInfo}
      setTitleInfo={setTitleInfo}
    />
  ) : (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};
const SendAuthMemo = React.memo(SendAuth);

export type ISendAuthenticationModalTitleInfo = {
  title: string;
  subTitle: string;
};
export const HDAccountAuthentication = () => {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const { walletId } = params;

  const [titleInfo, setTitleInfo] = useState<
    ISendAuthenticationModalTitleInfo | undefined
  >();

  // TODO all Modal close should reject dapp call
  return (
    <Modal
      header={titleInfo?.title}
      headerDescription={titleInfo?.subTitle}
      footer={null}
    >
      <Box flex={1}>
        <DecodeTxButtonTest encodedTx={params.encodedTx} />
        <Protected walletId={walletId} field={ValidationFields.Payment}>
          {(password) => (
            <SendAuthMemo setTitleInfo={setTitleInfo} password={password} />
          )}
        </Protected>
      </Box>
    </Modal>
  );
};

export default HDAccountAuthentication;
