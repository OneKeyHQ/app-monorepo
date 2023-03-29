import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { isEmpty, map } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Progress,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import type { OneKeyError } from '@onekeyhq/engine/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  IEncodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import { isExternalAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../../components/Protected';
import { useNetwork } from '../../../hooks';
import { useInteractWithInfo } from '../../../hooks/useDecodedTx';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { useWallet } from '../../../hooks/useWallet';
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';
import { useSignOrSendOfExternalAccount } from '../../ExternalAccount/SendConfirm/useSignOrSendOfExternalAccount';
import { BaseSendModal } from '../components/BaseSendModal';
import { BatchSendState } from '../enums';
import { useBatchSendConfirmDecodedTxs } from '../utils/useBatchSendConfirmDecodedTxs';

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
  SendModalRoutes.BatchSendProgress
>;
type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendModalRoutes.BatchSendProgress
>;
type EnableLocalAuthenticationProps = {
  password: string;
  currentState: BatchSendState;
  setCurrentState: (state: BatchSendState) => void;
  setTitleInfo: (titleInfo: ISendAuthenticationModalTitleInfo) => void;
};

const MAX_CONFIRM_RETRY = 10;

function SendProgress({
  password,
  currentState,
  setCurrentState,
}: EnableLocalAuthenticationProps) {
  const [currentProgerss, setCurrentProgress] = useState(0);
  const [currentFinished, setCurrentFinished] = useState(0);
  const navigation = useNavigation<NavigationProps>();

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
    feeInfoPayloads,
    backRouteName,
    sourceInfo,
    signOnly = false,
  } = route.params;
  const payload = payloadInfo || route.params.payload;

  const interactInfo = useInteractWithInfo({ sourceInfo });
  const isExternal = useMemo(
    () => isExternalAccount({ accountId }),
    [accountId],
  );
  const { sendTxForExternalAccount } = useSignOrSendOfExternalAccount({
    encodedTx: undefined,
    sourceInfo,
    networkId,
    accountId,
    signOnly,
  });
  const progressState = useRef(currentState);
  const { wallet } = useWallet({ walletId });
  const { network } = useNetwork({ networkId });

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
  const canPause = inProgress && currentProgerss < txCount - 2;

  const waitUntilInProgress: () => Promise<boolean> = useCallback(async () => {
    if (progressState.current === BatchSendState.inProgress)
      return Promise.resolve(true);
    await wait(1000);
    return waitUntilInProgress();
  }, [progressState]);

  const sendTxs = useCallback(async (): Promise<ISignedTxPro[]> => {
    const result: ISignedTxPro[] = [];
    for (let i = 0, txsLength = encodedTxs.length; i < txsLength; i += 1) {
      await waitUntilInProgress();
      setCurrentProgress(i + 1);
      debugLogger.sendTx.info('Authentication sendTx:', route.params);

      let signedTx = null;
      const encodedTx = encodedTxs[i];

      if (isExternal) {
        signedTx = await sendTxForExternalAccount(encodedTx);
      } else {
        signedTx =
          await backgroundApiProxy.serviceBatchTransfer.signAndSendEncodedTx({
            password,
            networkId,
            accountId,
            encodedTx,
            signOnly,
            pendingTxs: map(result, (tx) => ({
              id: tx.txid,
            })),
          });
      }

      result.push(signedTx as ISignedTxPro);
      if (signedTx) {
        await backgroundApiProxy.serviceHistory.saveSendConfirmHistory({
          networkId,
          accountId,
          data: {
            signedTx,
            encodedTx: encodedTxs[i],
            decodedTx: (
              await backgroundApiProxy.engine.decodeTx({
                networkId,
                accountId,
                encodedTx: encodedTxs[i],
                payload,
                interactInfo,
              })
            ).decodedTx,
          },
          feeInfo: feeInfoPayloads[i]?.current.value,
        });
      }

      debugLogger.sendTx.info(
        'Authentication sendTx DONE:',
        route.params,
        result,
      );
      // eslint-disable-next-line @typescript-eslint/no-shadow
      setCurrentFinished(i + 1);

      if (signedTx?.txid && i < txsLength - 1 && network?.impl === IMPL_SOL) {
        let status =
          await backgroundApiProxy.serviceBatchTransfer.confirmTransaction({
            networkId,
            txid: signedTx?.txid,
          });
        let retryTime = 0;
        while (
          status !== TransactionStatus.CONFIRM_AND_SUCCESS &&
          status !== TransactionStatus.CONFIRM_BUT_FAILED &&
          retryTime < MAX_CONFIRM_RETRY
        ) {
          await wait(5000);
          status =
            await backgroundApiProxy.serviceBatchTransfer.confirmTransaction({
              networkId,
              txid: signedTx?.txid,
            });
          retryTime += 1;
        }
      }
    }
    return result;
  }, [
    encodedTxs,
    waitUntilInProgress,
    route.params,
    isExternal,
    network?.impl,
    sendTxForExternalAccount,
    password,
    networkId,
    accountId,
    signOnly,
    payload,
    interactInfo,
    feeInfoPayloads,
  ]);

  const submit = useCallback(async () => {
    try {
      if (submitted.current) {
        return;
      }
      submitted.current = true;
      let submitEncodedTxs: IEncodedTx[] = encodedTxs;
      let result: any;
      let signedTxs: ISignedTxPro[] = [];

      if (!isEmpty(submitEncodedTxs)) {
        signedTxs = await sendTxs();
        result = signedTxs;

        if (isEmpty(signedTxs)) {
          return;
        }

        // encodedTx will be edit by buildUnsignedTx, re-assign encodedTx
        const encodedTxsTemp = map(signedTxs, 'encodedTx').filter(Boolean);
        if (encodedTxsTemp.length !== signedTxs.length) {
          throw new Error(
            'signedTxs including null encodedTx, please check code',
          );
        }
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
    encodedTxs,
    interactInfo,
    intl,
    navigation,
    networkId,
    onSuccess,
    onFail,
    payload,
    sendTxs,
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
      height="489px"
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
