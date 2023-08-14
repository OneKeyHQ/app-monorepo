import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, map } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Progress,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import {
  OneKeyError,
  OneKeyErrorClassNames,
} from '@onekeyhq/engine/src/errors';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
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
import { deviceUtils } from '../../../utils/hardware';
import { wait } from '../../../utils/helper';
import { useSignOrSendOfExternalAccount } from '../../ExternalAccount/SendConfirm/useSignOrSendOfExternalAccount';
import { BaseSendModal } from '../components/BaseSendModal';
import { BatchSendState } from '../enums';
import { useBatchSendConfirmDecodedTxs } from '../utils/useBatchSendConfirmDecodedTxs';

import type {
  BatchSendConfirmPayloadInfo,
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
  currentStep: number;
  setCurrentStep: (step: number) => void;
  setCurrentState: (state: BatchSendState) => void;
  setTitleInfo: (titleInfo: ISendAuthenticationModalTitleInfo) => void;
  setIsAuthorized: (isAuthorized: boolean) => void;
};

const MAX_CONFIRM_RETRY = 10;

function SendProgress({
  password,
  currentStep,
  setCurrentStep,
  currentState,
  setIsAuthorized,
}: EnableLocalAuthenticationProps) {
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
    bulkType,
  } = route.params;
  const payload = payloadInfo as BatchSendConfirmPayloadInfo;

  const { senderAccounts, transferInfos } = payload;

  const [currentTxInterval, setCurrentTxInterval] = useState<
    string | undefined
  >();

  const interactInfo = useInteractWithInfo({ sourceInfo });
  const isManyToN = useMemo(
    () =>
      bulkType === BulkTypeEnum.ManyToMany ||
      bulkType === BulkTypeEnum.ManyToOne,
    [bulkType],
  );
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
  const isAborted = useRef(false);
  const [currentWallet, setCurrentWallet] = useState<Wallet>();
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
  const progress = new BigNumber(currentStep / txCount).toNumber();

  const waitUntilInProgress: () => Promise<boolean> = useCallback(async () => {
    if (
      progressState.current === BatchSendState.inProgress ||
      isAborted.current
    )
      return Promise.resolve(true);
    await wait(1000);
    return waitUntilInProgress();
  }, [isAborted]);

  const sendTxs = useCallback(async (): Promise<ISignedTxPro[]> => {
    const result: ISignedTxPro[] = [];
    for (
      let i = currentStep, txsLength = encodedTxs.length;
      i < txsLength;
      i += 1
    ) {
      setCurrentWallet(
        await backgroundApiProxy.engine.getWallet(
          senderAccounts?.[i]?.walletId ?? walletId,
        ),
      );
      await waitUntilInProgress();

      debugLogger.sendTx.info('Authentication sendTx:', route.params);

      let signedTx = null;
      let senderAccountId;
      const encodedTx = encodedTxs[i];
      const transferInfo = transferInfos?.[i];

      if (isManyToN) {
        senderAccountId = senderAccounts?.[i]?.accountId;
      } else {
        senderAccountId = accountId;
      }

      if (!senderAccountId) {
        throw new OneKeyError('Can not get sender account id.');
      }

      setCurrentTxInterval(transferInfo?.txInterval);

      if (transferInfo?.txInterval) {
        await wait(
          new BigNumber(transferInfo.txInterval).times(1000).toNumber(),
        );
        setCurrentTxInterval('');
      }

      if (isAborted.current) {
        return signedTx ?? [];
      }

      if (isExternal) {
        signedTx = await sendTxForExternalAccount(encodedTx);
      } else {
        signedTx =
          await backgroundApiProxy.serviceBatchTransfer.signAndSendEncodedTx({
            password,
            networkId,
            accountId: senderAccountId,
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
          accountId: senderAccountId,
          data: {
            signedTx,
            encodedTx: encodedTxs[i],
            decodedTx: (
              await backgroundApiProxy.engine.decodeTx({
                networkId,
                accountId: senderAccountId,
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
      setCurrentStep(i + 1);

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
    currentStep,
    encodedTxs,
    senderAccounts,
    walletId,
    waitUntilInProgress,
    route.params,
    transferInfos,
    isManyToN,
    isExternal,
    setCurrentStep,
    network?.impl,
    accountId,
    sendTxForExternalAccount,
    password,
    networkId,
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
          isAborted: isAborted.current,
          senderAccounts,
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
    encodedTxs,
    sendTxs,
    payload,
    onSuccess,
    isAborted,
    senderAccounts,
    networkId,
    accountId,
    interactInfo,
    backRouteName,
    onFail,
    navigation,
    intl,
  ]);

  useEffect(
    () => () => {
      enableGoBack.current = false;
      isAborted.current = true;
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

  useEffect(() => {
    setIsAuthorized(!isNil(password));
  }, [password, setIsAuthorized]);

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
                    >{`${currentStep} / ${txCount}\n`}</Text>
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
      {inProgress ? (
        <Text typography="Body1Strong" color="text-subdued">
          {currentTxInterval
            ? intl.formatMessage(
                { id: 'form__delay_str' },
                { duration: `${currentTxInterval}s` },
              )
            : ''}
        </Text>
      ) : null}
      {txCount > 1 && currentWallet?.type === 'hw' && inProgress && (
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
    </Center>
  );
}
const SendProgressMemo = memo(SendProgress);

function BatchSendProgress() {
  const route = useRoute<RouteProps>();
  const { params } = route;
  const {
    walletId,
    onModalClose,
    networkId,
    accountId,
    payloadInfo,
    encodedTxs,
  } = params;
  const [titleInfo, setTitleInfo] = useState<
    ISendAuthenticationModalTitleInfo | undefined
  >();
  const [currentState, setCurrentState] = useState(BatchSendState.inProgress);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const onPause = currentState === BatchSendState.onPause;

  const payload = payloadInfo as BatchSendConfirmPayloadInfo;

  const { senderAccounts } = payload;

  const canPause = currentStep < encodedTxs.length - 1;

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
      footer={isAuthorized ? undefined : null}
      hidePrimaryAction={!isAuthorized}
      hideSecondaryAction={!isAuthorized}
      primaryActionTranslationId={
        onPause ? 'action__continue' : 'action__pause'
      }
      secondaryActionTranslationId="action__abort"
      primaryActionProps={{
        isDisabled: !canPause && !onPause,
      }}
      onPrimaryActionPress={() =>
        setCurrentState(
          onPause ? BatchSendState.inProgress : BatchSendState.onPause,
        )
      }
    >
      <Box flex={1}>
        <Protected
          walletId={senderAccounts?.[currentStep]?.walletId ?? walletId}
          field={ValidationFields.Payment}
        >
          {(password) => (
            <SendProgressMemo
              setIsAuthorized={setIsAuthorized}
              setTitleInfo={setTitleInfo}
              password={password}
              currentState={currentState}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              setCurrentState={setCurrentState}
            />
          )}
        </Protected>
      </Box>
    </BaseSendModal>
  );
}

export { BatchSendProgress };
