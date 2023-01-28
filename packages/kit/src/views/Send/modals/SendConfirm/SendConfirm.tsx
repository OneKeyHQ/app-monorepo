import { useCallback, useMemo } from 'react';

import type {
  IFeeInfoUnit,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';
import { ENABLED_DAPP_SCOPE } from '@onekeyhq/shared/src/background/backgroundUtils';
import { IMPL_COSMOS } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useWalletConnectPrepareConnection } from '../../../../components/WalletConnect/useWalletConnectPrepareConnection';
import { useActiveSideAccount } from '../../../../hooks';
import { useDecodedTx } from '../../../../hooks/useDecodedTx';
import { useDisableNavigationAnimation } from '../../../../hooks/useDisableNavigationAnimation';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import { TxDetailView } from '../../../TxDetail/TxDetailView';
import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';
import { FeeInfoInputForConfirmLite } from '../../components/FeeInfoInput';
import { SendConfirmErrorsAlert } from '../../components/SendConfirmErrorsAlert';
import { SendRoutes } from '../../types';
import {
  FEE_INFO_POLLING_INTERVAL,
  useFeeInfoPayload,
} from '../../utils/useFeeInfoPayload';
import { useReloadAccountBalance } from '../../utils/useReloadAccountBalance';
import { useSendConfirmEncodedTx } from '../../utils/useSendConfirmEncodedTx';
import { useSendConfirmRouteParamsParsed } from '../../utils/useSendConfirmRouteParamsParsed';

import { SendConfirmLoading } from './SendConfirmLoading';
import { SendConfirmSpeedUpOrCancel } from './SendConfirmSpeedUpOrCancel';
import { SendConfirmTransfer } from './SendConfirmTransfer';

import type {
  HardwareSwapContinueParams,
  ITxConfirmViewProps,
  ITxConfirmViewPropsHandleConfirm,
  SendAuthenticationParams,
  SendFeedbackReceiptParams,
} from '../../types';

function SendConfirm({
  sendConfirmParamsParsed,
}: {
  sendConfirmParamsParsed: ReturnType<typeof useSendConfirmRouteParamsParsed>;
}) {
  useOnboardingRequired();
  const { engine, serviceHistory, serviceToken } = backgroundApiProxy;

  const {
    navigation,
    routeParams,
    feeInfoEditable,
    feeInfoUseFeeInTx,
    sourceInfo,
    payload,
    payloadInfo,
    resendActionInfo,
    isSpeedUpOrCancel,
    isFromDapp,
    dappApprove,
    onModalClose,
    networkId,
    accountId,
  } = sendConfirmParamsParsed;
  useReloadAccountBalance({ networkId, accountId });

  const { walletId, networkImpl, account, wallet } = useActiveSideAccount({
    accountId,
    networkId,
  });

  useDisableNavigationAnimation({
    condition: !!routeParams.autoConfirmAfterFeeSaved,
  });

  const { encodedTx } = useSendConfirmEncodedTx({
    sendConfirmParams: routeParams,
    networkImpl,
    address: account?.address || '',
  });

  const { decodedTx } = useDecodedTx({
    accountId,
    networkId,
    encodedTx,
    payload: payloadInfo || payload,
    sourceInfo,
  });

  const isInternalNativeTransferType = useMemo(() => {
    // TODO also check payloadInfo.type===NativeTransfer
    if (isFromDapp || !payload) {
      return false;
    }
    if (decodedTx && decodedTx?.actions?.length === 1) {
      const action = decodedTx.actions[0];
      if (action.type === IDecodedTxActionType.NATIVE_TRANSFER) {
        return true;
      }
    }
    return false;
  }, [decodedTx, isFromDapp, payload]);

  const { feeInfoError, feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    accountId,
    networkId,
    encodedTx,
    useFeeInTx: feeInfoUseFeeInTx,
    pollingInterval: feeInfoEditable ? FEE_INFO_POLLING_INTERVAL : 0,
    signOnly: routeParams.signOnly,
    payload: payloadInfo || payload,
  });

  useWalletConnectPrepareConnection({
    accountId,
    networkId,
  });

  // onSubmit, onConfirm, onNext
  const handleConfirm = useCallback<ITxConfirmViewPropsHandleConfirm>(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    async ({ close, encodedTx }) => {
      if (!encodedTx) {
        return;
      }
      let encodedTxWithFee = encodedTx;
      let feeInfoValue: IFeeInfoUnit | undefined;
      if (feeInfoEditable && feeInfoPayload) {
        feeInfoValue = feeInfoPayload?.current.value;
        encodedTxWithFee = await engine.attachFeeInfoToEncodedTx({
          networkId,
          accountId,
          encodedTx,
          feeInfoValue,
        });
      }
      const onFail = (error: Error) => {
        dappApprove.reject({
          error,
        });
      };
      const onSuccess: SendAuthenticationParams['onSuccess'] = async (
        tx: ISignedTxPro,
        data,
      ) => {
        // refresh balance
        serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
        if (routeParams.signOnly) {
          if (
            networkImpl === IMPL_COSMOS
            // get(tx, 'encodedTx.mode') === 'amino'
          ) {
            await dappApprove.resolve({ result: tx });
          } else {
            await dappApprove.resolve({ result: tx.rawTx });
          }
        } else {
          await dappApprove.resolve({
            result: tx.txid,
          });
          await serviceHistory.saveSendConfirmHistory({
            networkId,
            accountId,
            data,
            resendActionInfo,
            feeInfo: feeInfoValue,
          });
        }

        if (
          payloadInfo?.swapInfo &&
          payloadInfo?.swapInfo.isApprove &&
          wallet?.type === 'hw'
        ) {
          const params: HardwareSwapContinueParams = {
            networkId,
            accountId,
            closeModal: close,
          };
          navigation.navigate(SendRoutes.HardwareSwapContinue, params);
        } else {
          const type = routeParams.signOnly ? 'Sign' : 'Send';
          const params: SendFeedbackReceiptParams = {
            networkId,
            accountId,
            txid: tx.txid ?? 'unknown_txid',
            type,
            closeModal: close,
            onDetail: routeParams.onDetail,
            isSingleTransformMode: true,
          };
          navigation.navigate(SendRoutes.SendFeedbackReceipt, params);
        }

        if (routeParams.onSuccess) {
          routeParams.onSuccess(tx, data);
        }
        serviceHistory.refreshHistoryUi();

        // navigate SendFeedbackReceipt onSuccess
        // close modal
        setTimeout(() => {
          // close()
        }, 0);
      };
      const nextRouteParams: SendAuthenticationParams = {
        ...routeParams,
        encodedTx: encodedTxWithFee,
        accountId,
        networkId,
        walletId,
        onSuccess,
        onFail,
        onModalClose,
      };
      // @ts-ignore
      delete nextRouteParams._disabledAnimationOfNavigate;
      let nextRouteAction: 'replace' | 'navigate' = 'navigate';
      if (routeParams.autoConfirmAfterFeeSaved) {
        // add delay to avoid white screen when navigation replace
        await wait(600);
        nextRouteAction = 'replace';
      }
      return navigation[nextRouteAction](
        SendRoutes.SendAuthentication,
        nextRouteParams,
      );
    },
    [
      feeInfoEditable,
      feeInfoPayload,
      routeParams,
      accountId,
      walletId,
      networkId,
      onModalClose,
      navigation,
      engine,
      dappApprove,
      serviceToken,
      payloadInfo?.swapInfo,
      wallet?.type,
      serviceHistory,
      resendActionInfo,
    ],
  );

  const feeInput = (
    <FeeInfoInputForConfirmLite
      accountId={accountId}
      networkId={networkId}
      sendConfirmParams={routeParams}
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
      feeInfoError={feeInfoError}
    />
  );
  const sharedProps: ITxConfirmViewProps = {
    accountId,
    networkId,

    sendConfirmParams: routeParams,

    sourceInfo,
    encodedTx,
    decodedTx,
    payload,

    feeInfoPayload,
    feeInfoLoading,
    feeInfoError,
    feeInfoEditable,
    feeInput,

    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    // reject with window.close in ext standalone window after modal closed
    onModalClose,
    children: null,
  };

  // waiting for tx decode
  const isWaitingTxReady = !decodedTx || !encodedTx;
  if (isWaitingTxReady) {
    return <SendConfirmLoading {...sharedProps} />;
  }

  // show SendConfirm TxDetail
  sharedProps.children = (
    <TxDetailView
      sendConfirmParamsParsed={sendConfirmParamsParsed}
      isSendConfirm
      decodedTx={decodedTx}
      feeInput={feeInput}
    />
  );

  if (isSpeedUpOrCancel) {
    return <SendConfirmSpeedUpOrCancel {...sharedProps} />;
  }

  // handle Max Native Transfer
  if (isInternalNativeTransferType) {
    return <SendConfirmTransfer {...sharedProps} />;
  }

  // internal transfer type, max send

  // handle speed up / cancel.

  // token approve

  // internal swap

  // TODO payload type check, SendConfirmTransfer

  // blind sign and send

  return <BaseSendConfirmModal {...sharedProps} />;
}

function SendConfirmProxy() {
  const sendConfirmParamsParsed = useSendConfirmRouteParamsParsed();
  const { sourceInfo, routeParams } = sendConfirmParamsParsed;
  const isNetworkNotMatched = useMemo(() => {
    if (!sourceInfo) {
      return false;
    }
    // dapp tx should check scope matched
    // TODO add injectedProviderName to vault settings
    return !ENABLED_DAPP_SCOPE.includes(sourceInfo.scope); // network.settings.injectedProviderName
  }, [sourceInfo]);

  if (isNetworkNotMatched) {
    return (
      <BaseSendConfirmModal
        accountId={routeParams.accountId}
        networkId={routeParams.networkId}
        sendConfirmParams={routeParams}
        feeInfoPayload={null}
        feeInfoLoading={false}
        encodedTx={null}
        handleConfirm={() => null}
      >
        <SendConfirmErrorsAlert isNetworkNotMatched />
      </BaseSendConfirmModal>
    );
  }
  return <SendConfirm sendConfirmParamsParsed={sendConfirmParamsParsed} />;
}

// export default SendConfirm;
export default SendConfirmProxy;
