import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { find } from 'lodash';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IFeeInfoUnit,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import {
  IDecodedTxActionType,
  IEncodedTxUpdateType,
} from '@onekeyhq/engine/src/vaults/types';
import { ENABLED_DAPP_SCOPE } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_SUI,
} from '@onekeyhq/shared/src/engine/engineConsts';

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
import { SendConfirmAdvancedSettings } from '../../components/SendConfirmAdvancedSettings';
import { SendConfirmErrorsAlert } from '../../components/SendConfirmErrorsAlert';
import { SendModalRoutes } from '../../types';
import {
  FEE_INFO_POLLING_INTERVAL,
  useFeeInfoPayload,
} from '../../utils/useFeeInfoPayload';
import { useReloadAccountBalance } from '../../utils/useReloadAccountBalance';
import { useSendConfirmAdvancedSettings } from '../../utils/useSendConfirmAdvancedSettings';
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
  const intl = useIntl();
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
    ignoreFetchFeeCalling,
  } = sendConfirmParamsParsed;
  useReloadAccountBalance({ networkId, accountId });

  const {
    isLoading: isLoadingAdvancedSettings,
    advancedSettings,
    setAdvancedSettings,
  } = useSendConfirmAdvancedSettings({ accountId, networkId });
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
    ignoreFetchFeeCalling,
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

      const encodedTxWithAdvancedSettings = await engine.updateEncodedTx({
        networkId,
        accountId,
        encodedTx: encodedTxWithFee,
        payload: advancedSettings,
        options: {
          type: IEncodedTxUpdateType.advancedSettings,
        },
      });

      const localPendingTxs = await serviceHistory.getLocalHistory({
        networkId,
        accountId,
        isPending: true,
        limit: 50,
      });

      const localPendingTxWithSameNonce = find(localPendingTxs, (tx) =>
        new BigNumber(
          (encodedTxWithAdvancedSettings as IEncodedTxEvm).nonce ?? 0,
        ).isEqualTo(tx.decodedTx.nonce),
      );

      if (localPendingTxWithSameNonce) {
        const { feeInfo } = localPendingTxWithSameNonce.decodedTx;
        if (feeInfo && feeInfoValue) {
          if (feeInfo.eip1559) {
            if (
              new BigNumber(
                feeInfo.price1559?.maxFeePerGas ?? 0,
              ).isGreaterThanOrEqualTo(
                feeInfoValue.price1559?.maxFeePerGas ?? 0,
              ) ||
              new BigNumber(
                feeInfo.price1559?.maxPriorityFeePerGas ?? 0,
              ).isGreaterThanOrEqualTo(
                feeInfoValue.price1559?.maxPriorityFeePerGas ?? 0,
              )
            ) {
              ToastManager.show(
                {
                  title: intl.formatMessage({
                    id: 'msg__invalid_rbf_tx_pay_a_higher_fee_and_retry',
                  }),
                },
                { type: 'error' },
              );
              return;
            }
          } else if (
            new BigNumber(feeInfo.price ?? 0).isGreaterThanOrEqualTo(
              feeInfoValue.price ?? 0,
            )
          ) {
            ToastManager.show(
              {
                title: intl.formatMessage({
                  id: 'msg__invalid_rbf_tx_pay_a_higher_fee_and_retry',
                }),
              },
              { type: 'error' },
            );
            return;
          }
        }
      }

      const result = await engine.specialCheckEncodedTx({
        networkId,
        accountId,
        encodedTx: encodedTxWithAdvancedSettings,
      });

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
          accountId,
          networkId,
        });
        if (routeParams.signOnly) {
          // TODO Unified return to tx related processes to handle their own
          if (
            networkImpl === IMPL_COSMOS ||
            networkImpl === IMPL_DOT ||
            networkImpl === IMPL_SUI
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
          navigation.navigate(SendModalRoutes.HardwareSwapContinue, params);
        } else if (!routeParams.hideSendFeedbackReceipt) {
          // Sometimes it is necessary to send multiple transactions. So the feedback are not displayed.
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
          navigation.navigate(SendModalRoutes.SendFeedbackReceipt, params);
        } else {
          setTimeout(() => {
            close();
          }, 0);
        }

        if (routeParams.onSuccess) {
          routeParams.onSuccess(tx, data);
        }
        serviceHistory.refreshHistoryUi();

        // navigate SendFeedbackReceipt onSuccess
        // close modal
        // setTimeout(() => {
        //   // close()
        // }, 0);
      };
      const nextRouteParams: SendAuthenticationParams = {
        ...routeParams,
        encodedTx: encodedTxWithAdvancedSettings,
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

      if (result.success) {
        return navigation[nextRouteAction](
          SendModalRoutes.SendAuthentication,
          nextRouteParams,
        );
      }

      return navigation[nextRouteAction](SendModalRoutes.SendSpecialWarning, {
        ...nextRouteParams,
        hintMsgKey: result.key ?? '',
        hintMsgParams: result.params,
      });
    },
    [
      feeInfoEditable,
      feeInfoPayload,
      engine,
      networkId,
      accountId,
      advancedSettings,
      serviceHistory,
      routeParams,
      walletId,
      onModalClose,
      navigation,
      dappApprove,
      intl,
      serviceToken,
      payloadInfo?.swapInfo,
      wallet?.type,
      networkImpl,
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

  const advancedSettingsForm = (
    <SendConfirmAdvancedSettings
      accountId={accountId}
      networkId={networkId}
      encodedTx={encodedTx}
      advancedSettings={advancedSettings}
      setAdvancedSettings={setAdvancedSettings}
      isLoadingAdvancedSettings={isLoadingAdvancedSettings}
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
    advancedSettings,
    advancedSettingsForm,

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
      advancedSettingsForm={advancedSettingsForm}
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
