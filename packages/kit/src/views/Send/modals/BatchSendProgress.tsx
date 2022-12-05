import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { NavigationProp } from '@react-navigation/core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { isEmpty, map } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Progress,
  Text,
  useToast,
} from '@onekeyhq/components';
import {
  OneKeyError,
  OneKeyErrorClassNames,
} from '@onekeyhq/engine/src/errors';
import { IEncodedTx, ISignedTx } from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../../components/Protected';
import { useInteractWithInfo } from '../../../hooks/useDecodedTx';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { useWallet } from '../../../hooks/useWallet';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';
import { BaseSendModal } from '../components/BaseSendModal';
import { BatchSendState } from '../enums';
import {
  ISendAuthenticationModalTitleInfo,
  SendConfirmPayloadInfo,
  SendRoutes,
  SendRoutesParams,
} from '../types';
import { useBatchSendConfirmDecodedTxs } from '../utils/useBatchSendConfirmDecodedTxs';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.BatchSendProgress>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.BatchSendProgress
>;
type EnableLocalAuthenticationProps = {
  password: string;
  currentState: BatchSendState;
  setCurrentState: (state: BatchSendState) => void;
  setTitleInfo: (titleInfo: ISendAuthenticationModalTitleInfo) => void;
};

function SendProgress({
  password,
  currentState,
  setCurrentState,
}: EnableLocalAuthenticationProps) {
  const [currentProgerss, setCurrentProgress] = useState(0);
  const [currentFinished, setCurrentFinished] = useState(0);
  const navigation = useNavigation<NavigationProps>();

  const toast = useToast();
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const submitted = useRef(false);
  const enableGoBack = useRef(true);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();
  const {
    networkId,
    accountId,
    encodedTxs,
    onSuccess,
    onFail,
    walletId,
    payloadInfo,
    backRouteName,
    sourceInfo,
    signOnly = false,
  } = route.params;
  const payload = payloadInfo || route.params.payload;

  const interactInfo = useInteractWithInfo({ sourceInfo });
  const progressState = useRef(currentState);
  const { wallet } = useWallet({ walletId });

  const inProgress = currentState === BatchSendState.inProgress;

  const { decodedTxs } = useBatchSendConfirmDecodedTxs({
    networkId,
    accountId,
    encodedTxs,
    sourceInfo,
    payload,
  });

  const txCount = encodedTxs.length;
  const progress = new BigNumber(currentFinished / txCount).toNumber();
  const canPause = inProgress && currentProgerss < txCount - 1;

  const waitUntilInProgress: () => Promise<boolean> = useCallback(async () => {
    if (progressState.current === BatchSendState.inProgress)
      return Promise.resolve(true);
    await wait(1000);
    return waitUntilInProgress();
  }, [progressState]);

  const sendTxs = useCallback(async (): Promise<ISignedTx[]> => {
    const result: ISignedTx[] = [];
    for (let i = 0; i < encodedTxs.length; i += 1) {
      await waitUntilInProgress();
      setCurrentProgress(i + 1);
      debugLogger.sendTx.info('Authentication sendTx:', route.params);
      const signedTx =
        await backgroundApiProxy.serviceBatchTransfer.signAndSendEncodedTx({
          password,
          networkId,
          accountId,
          encodedTx: encodedTxs[i],
          signOnly,
          pendingTxs: map(result, (tx) => ({
            id: tx.txid,
          })),
        });
      result.push(signedTx as ISignedTx);
      await wait(3000);
      debugLogger.sendTx.info(
        'Authentication sendTx DONE:',
        route.params,
        result,
      );
      // eslint-disable-next-line @typescript-eslint/no-shadow
      setCurrentFinished(i + 1);
    }
    return result;
  }, [
    accountId,
    encodedTxs,
    networkId,
    password,
    route.params,
    signOnly,
    waitUntilInProgress,
  ]);

  const submit = useCallback(async () => {
    try {
      if (submitted.current) {
        return;
      }
      submitted.current = true;
      let submitEncodedTxs: IEncodedTx[] = encodedTxs;
      let result: any;
      let signedTxs: ISignedTx[] = [];

      if (!isEmpty(submitEncodedTxs)) {
        signedTxs = await sendTxs();
        result = signedTxs;

        if (isEmpty(signedTxs)) {
          return;
        }

        // encodedTx will be edit by buildUnsignedTx, re-assign encodedTx
        const encodedTxsTemp = map(signedTxs, 'encodedTx');
        submitEncodedTxs = isEmpty(encodedTxsTemp)
          ? submitEncodedTxs
          : encodedTxsTemp;
      }

      if (!isEmpty(result)) {
        let txPayload = payload as SendConfirmPayloadInfo | undefined;
        if (
          txPayload?.type === 'InternalSwap' &&
          txPayload?.swapInfo &&
          txPayload?.swapInfo?.isApprove
        ) {
          txPayload = undefined;
        }
        onSuccess?.(result, {
          signedTxs,
          encodedTxs: submitEncodedTxs,
          decodedTxs: isEmpty(submitEncodedTxs)
            ? []
            : map(
                await Promise.all(
                  submitEncodedTxs.map((encodedTx) =>
                    backgroundApiProxy.engine.decodeTx({
                      networkId,
                      accountId,
                      encodedTx,
                      payload: txPayload,
                      interactInfo,
                    }),
                  ),
                ),
                'decodedTx',
              ),
        });
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
      await wait(600);
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
          if (!deviceUtils.showErrorToast(error)) {
            toast.show(
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
      // onFail() should be called after show toast, otherwise toast won't display
      onFail?.(error);
    }
  }, [
    accountId,
    backRouteName,
    encodedTxs,
    interactInfo,
    intl,
    navigation,
    networkId,
    onSuccess,
    onFail,
    payload,
    sendTxs,
    toast,
  ]);

  useEffect(
    () => () => {
      enableGoBack.current = false;
      clearInterval(progressInterval.current);
    },
    [progressInterval, enableGoBack],
  );
  useEffect(() => {
    if (!isEmpty(decodedTxs)) {
      submit();
    }
  }, [decodedTxs, submit]);

  useEffect(() => {
    progressState.current = currentState;
  }, [currentState]);

  return (
    <Center h="full" w="full">
      <Box position="relative">
        <Progress.Circle
          progress={progress}
          text={
            <>
              <Text
                typography="Body2Strong"
                color="text-subdued"
                textAlign="center"
              >
                {intl.formatMessage(
                  {
                    id: 'form__str_transactions',
                  },
                  {
                    0: (
                      <Text
                        typography="DisplayMedium"
                        textAlign="center"
                      >{`${currentFinished} / ${txCount}\n`}</Text>
                    ),
                  },
                )}
              </Text>
            </>
          }
        />
      </Box>
      <Text typography="DisplayMedium" mt="24px" textAlign="center">
        {currentState === BatchSendState.inProgress &&
          intl.formatMessage({ id: 'title__transactions_in_progress' })}
        {currentState === BatchSendState.onPause &&
          intl.formatMessage({
            id: 'title__you_ve_paused_the_transaction_generation',
          })}
      </Text>
      {wallet?.type === 'hw' && inProgress && (
        <Text
          textAlign="center"
          mt="4px"
          typography="DisplaySmall"
          color="text-subdued"
        >
          {intl.formatMessage({
            id: 'content__you_may_receive_multiple_signing_requests_on_the_hardware_wallet',
          })}
        </Text>
      )}
      {!inProgress && (
        <Text
          textAlign="center"
          mt="4px"
          typography="DisplaySmall"
          color="text-subdued"
        >
          {intl.formatMessage({
            id: 'content__if_you_want_to_cancel_transactions_that_has_already_been_generated',
          })}
        </Text>
      )}

      <Button
        type="basic"
        mt="16px"
        onPress={() => setCurrentState(BatchSendState.onPause)}
        opacity={canPause ? 1 : 0}
        disabled={!canPause}
      >
        {intl.formatMessage({ id: 'action__pause' })}
      </Button>
    </Center>
  );
}
const SendProgressMemo = memo(SendProgress);

function BatchSendProgress() {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const { walletId, onModalClose, networkId, accountId } = params;
  const [titleInfo, setTitleInfo] = useState<
    ISendAuthenticationModalTitleInfo | undefined
  >();
  const [currentState, setCurrentState] = useState(BatchSendState.inProgress);
  const onPause = currentState === BatchSendState.onPause;

  return (
    <BaseSendModal
      closeable={false}
      hideBackButton
      height="auto"
      closeOnOverlayClick={false}
      accountId={accountId}
      networkId={networkId}
      header={titleInfo?.title}
      headerDescription={titleInfo?.subTitle}
      onModalClose={() => {
        onModalClose?.();
        closeExtensionWindowIfOnboardingFinished();
      }}
      footer={onPause ? undefined : null}
      hidePrimaryAction={!onPause}
      hideSecondaryAction={!onPause}
      primaryActionTranslationId="action__continue"
      secondaryActionTranslationId="action__abort"
      onPrimaryActionPress={() => setCurrentState(BatchSendState.inProgress)}
    >
      <Box flex={1}>
        <Protected walletId={walletId} field={ValidationFields.Payment}>
          {(password) => (
            <SendProgressMemo
              setTitleInfo={setTitleInfo}
              password={password}
              currentState={currentState}
              setCurrentState={setCurrentState}
            />
          )}
        </Protected>
      </Box>
    </BaseSendModal>
  );
}

export { BatchSendProgress };
