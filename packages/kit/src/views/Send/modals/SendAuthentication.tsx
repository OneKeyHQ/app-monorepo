import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Spinner, ToastManager } from '@onekeyhq/components';
import type { OneKeyError } from '@onekeyhq/engine/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import type {
  IEncodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';
import { isExternalAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../../components/Protected';
import { useDecodedTx, useInteractWithInfo } from '../../../hooks/useDecodedTx';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';
import { AuthExternalAccountInfo } from '../../ExternalAccount/SendConfirm/AuthExternalAccountInfo';
import {
  useSignOrSendOfBtcExternalAccount,
  useSignOrSendOfExternalAccount,
} from '../../ExternalAccount/SendConfirm/useSignOrSendOfExternalAccount';
import { BaseSendModal } from '../components/BaseSendModal';
import { DecodeTxButtonTest } from '../components/DecodeTxButtonTest';

import type {
  ISendAuthenticationModalTitleInfo,
  SendConfirmPayloadInfo,
  SendModalRoutes,
  SendRoutesParams,
} from '../types';
import type { NavigationProp } from '@react-navigation/core';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.SendAuthentication
>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendModalRoutes.SendAuthentication
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
    signOnly = false, // sign tx only but not send it
  } = route.params;
  const payload = payloadInfo || route.params.payload;

  const { decodedTx } = useDecodedTx({
    accountId,
    networkId,
    encodedTx,
    payload,
  });
  const interactInfo = useInteractWithInfo({ sourceInfo });
  const isExternal = useMemo(
    () => isExternalAccount({ accountId }),
    [accountId],
  );

  const {
    externalAccountInfo,
    sendTxForExternalAccount,
    signMsgForExternalAccount,
  } = useSignOrSendOfExternalAccount({
    encodedTx,
    unsignedMessage,
    sourceInfo,
    networkId,
    accountId,
    signOnly,
  });

  const { sendTxForBtcExternalAccount } = useSignOrSendOfBtcExternalAccount({
    encodedTx,
    sourceInfo,
    networkId,
    accountId,
    signOnly,
  });

  const sendTx = useCallback(async (): Promise<ISignedTxPro | undefined> => {
    if (isExternal) {
      if (isBTCNetwork(networkId)) {
        return sendTxForBtcExternalAccount();
      }
      return sendTxForExternalAccount();
    }

    debugLogger.sendTx.info('Authentication sendTx:', route.params);
    // TODO needs wait rpc call finished, close Modal will cause tx send fail
    const result = await backgroundApiProxy.engine.signAndSendEncodedTx({
      password,
      networkId,
      accountId,
      encodedTx,
      signOnly,
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
    sendTxForBtcExternalAccount,
    signOnly,
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
      let signedTx: ISignedTxPro | undefined;
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
        let txPayload = payload as SendConfirmPayloadInfo | undefined;
        if (
          txPayload?.type === 'InternalSwap' &&
          txPayload?.swapInfo &&
          txPayload?.swapInfo?.isApprove
        ) {
          txPayload = undefined;
        }
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
                  payload: txPayload,
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
        if (
          error?.data?.message.includes('nonce') &&
          error?.data?.message.includes('high')
        ) {
          error.data.message = intl.formatMessage({
            id: 'msg__invalid_tx_that_nonce_is_higher_than_default',
          });
        }
        ToastManager.show(
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
          if (!deviceUtils.showErrorToast(error)) {
            ToastManager.show(
              {
                title: msg || intl.formatMessage({ id: 'transaction__failed' }),
                description: msg,
              },
              { type: 'error' },
            );
          }
        }
      }

      await wait(100);
      // onFail() should be called after show otherwise toast won't display
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
      <Spinner testID="SendAuth-Default-Spinner" size="lg" />
    </Center>
  );
};
const SendAuthMemo = memo(SendAuth);

export const SendAuthentication = () => {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const { walletId, onModalClose, networkId, accountId } = params;
  const [titleInfo, setTitleInfo] = useState<
    ISendAuthenticationModalTitleInfo | undefined
  >();

  // TODO all Modal close should reject dapp call
  return (
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      header={titleInfo?.title}
      headerDescription={titleInfo?.subTitle}
      footer={null}
      onModalClose={() => {
        onModalClose?.();
        closeExtensionWindowIfOnboardingFinished();
      }}
    >
      <Box flex={1}>
        <DecodeTxButtonTest
          accountId={accountId}
          networkId={networkId}
          encodedTx={params.encodedTx}
        />
        <Protected walletId={walletId} field={ValidationFields.Payment}>
          {(password) => (
            <SendAuthMemo setTitleInfo={setTitleInfo} password={password} />
          )}
        </Protected>
      </Box>
    </BaseSendModal>
  );
};
