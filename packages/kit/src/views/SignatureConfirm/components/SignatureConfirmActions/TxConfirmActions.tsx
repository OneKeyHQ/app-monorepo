import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil, isUndefined } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  Page,
  Stack,
  Toast,
  usePageUnMounted,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import type { IHasId, LinkedDeck } from '@onekeyhq/kit/src/hooks/useLinkedList';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import useShouldRejectDappAction from '@onekeyhq/kit/src/hooks/useShouldRejectDappAction';
import {
  useCustomRpcStatusAtom,
  useDecodedTxsAtom,
  useDecodedTxsInitAtom,
  useEffectiveFeePayerAtom,
  useGasAccountUiStateAtom,
  useMegafuelEligibleAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePreCheckTxStatusAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useSignatureConfirmActions,
  useTronResourceRentalInfoAtom,
  useTxAdvancedSettingsAtom,
  useTxFeeInfoInitAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  getGasAccountErrorCode,
  isGasAccountSubmitCancelledError,
} from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsEmptyData } from '@onekeyhq/shared/src/utils/evmUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getTxnType } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type { IGasAccountScenario } from '@onekeyhq/shared/types/fee';
import type { IEncodedTxLightning } from '@onekeyhq/shared/types/lightning';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EReplaceTxType,
  type IReplaceTxInfo,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
} from '../../constants/gasAccountErrorCodes';
import { usePreCheckFeeInfo } from '../../hooks/usePreCheckFeeInfo';
import { showCustomHexDataAlert } from '../CustomHexDataAlert';
import TxFeeInfo from '../TxFee';

function muteHandledErrorToast(error: unknown) {
  const e = error as IOneKeyError | undefined;
  if (e) {
    e.autoToast = false;
  }
}

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  sourceInfo?: IDappSourceInfo;
  signOnly?: boolean;
  transferPayload?: ITransferPayload;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  popStack?: boolean;
  isQueueMode?: boolean;
  unsignedTxQueue?: LinkedDeck<IUnsignedTxPro & IHasId>;
  gasAccountScenario?: IGasAccountScenario;
};

function TxConfirmActions(props: IProps) {
  const {
    accountId,
    networkId,
    onSuccess,
    onFail,
    onCancel,
    sourceInfo,
    signOnly,
    transferPayload,
    useFeeInTx,
    feeInfoEditable,
    popStack = true,
    isQueueMode,
    unsignedTxQueue,
    gasAccountScenario,
  } = props;
  const intl = useIntl();
  const isSubmitted = useRef(false);
  const [continueOperate, setContinueOperate] = useState(false);

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [effectiveFeePayer] = useEffectiveFeePayerAtom();
  const [gasAccountUiState] = useGasAccountUiStateAtom();
  const [megafuelEligible] = useMegafuelEligibleAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [preCheckTxStatus] = usePreCheckTxStatusAtom();
  const [txAdvancedSettings] = useTxAdvancedSettingsAtom();
  const [{ isBuildingDecodedTxs, decodedTxs }] = useDecodedTxsAtom();
  const {
    updateEffectiveFeePayer,
    updateGasAccountTemporarilyDisabled,
    resetGasAccountTemporarilyDisabled,
    updateGasAccountUiState,
    resetGasAccountUiState,
    updateSendFeeStatus,
    updateSendTxStatus,
    updateTxFeeInfoInit,
    updateUnsignedTxs,
  } = useSignatureConfirmActions().current;
  const successfullySentTxs = useRef<string[]>([]);
  // Identifies the current submit attempt so the background retry loop can be
  // aborted from the cancel handler. Rotated on every fresh submit; cleared
  // once the attempt has terminated (success / failure / cancel).
  const gasAccountSubmitIdRef = useRef<string | null>(null);
  const { bottom } = useSafeAreaInsets();
  const [tronResourceRentalInfo] = useTronResourceRentalInfoAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
  const [decodedTxsInit] = useDecodedTxsInitAtom();
  const [customRpcStatus] = useCustomRpcStatusAtom();
  const [settings] = useSettingsPersistAtom();
  const [gasAccountNow, setGasAccountNow] = useState(Date.now());
  const [gasAccountRetryState, setGasAccountRetryState] = useState<{
    attempt: number;
    maxAttempts: number;
    retryAfterSec: number;
    scheduledAt: number;
  } | null>(null);

  const toAddress = transferPayload?.originalRecipient;
  const unsignedTx = unsignedTxs[0];
  const isMegafuelSponsored =
    effectiveFeePayer === 'megafuel' || megafuelEligible.sponsorable;
  const isGasAccountSponsored = effectiveFeePayer === 'gasAccount';
  const isFeeSponsored = isMegafuelSponsored || isGasAccountSponsored;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const { shouldRejectDappAction } = useShouldRejectDappAction();

  const vaultSettings = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      }),
    [networkId],
  ).result;

  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo();

  const handleGasAccountSubmitError = useCallback(
    (error: unknown): EGasAccountErrorStrategy | undefined => {
      if (gasAccountUiState.selectedPayer !== 'gasAccount') {
        return undefined;
      }

      const code = getGasAccountErrorCode(error);
      const entry = getGasAccountErrorEntry(code);
      if (!entry) {
        if (typeof code === 'number') {
          // Unknown-but-numeric code — surface in dev so contract drift
          // against the backend spec is visible, but don't alter UX.
          console.warn(
            `[GasAccount] unhandled submit error code ${code} on network ${networkId}`,
          );
        }
        return undefined;
      }

      const message = intl.formatMessage({ id: entry.messageKey });

      if (entry.strategy === EGasAccountErrorStrategy.Refresh) {
        muteHandledErrorToast(error);
        resetGasAccountTemporarilyDisabled();
        resetGasAccountUiState();
        updateTxFeeInfoInit(false);
        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
          errMessage: '',
          discountPercent: 0,
        });
        Toast.warning({ title: message });
        appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
        return EGasAccountErrorStrategy.Refresh;
      }

      if (entry.strategy === EGasAccountErrorStrategy.Fallback) {
        muteHandledErrorToast(error);
        updateEffectiveFeePayer('user');
        updateGasAccountTemporarilyDisabled(true);
        resetGasAccountUiState();
        updateGasAccountUiState({ payer: 'user' });
        updateTxFeeInfoInit(false);
        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
          errMessage: '',
          discountPercent: 0,
        });
        if (!entry.suppressToast) {
          Toast.warning({ title: message });
        }
        appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
        return EGasAccountErrorStrategy.Fallback;
      }

      // Hint: suppress the generic toast, show our specific copy, but let the
      // caller still invoke onFail / dappApprove.reject — the current attempt
      // is terminal and the dApp needs to know. Entries flagged suppressToast
      // skip the user-facing copy entirely while preserving the reject path.
      muteHandledErrorToast(error);
      if (!entry.suppressToast) {
        Toast.warning({ title: message });
      }
      return EGasAccountErrorStrategy.Hint;
    },
    [
      gasAccountUiState.selectedPayer,
      networkId,
      resetGasAccountTemporarilyDisabled,
      resetGasAccountUiState,
      updateEffectiveFeePayer,
      updateGasAccountTemporarilyDisabled,
      updateGasAccountUiState,
      updateSendFeeStatus,
      updateTxFeeInfoInit,
      intl,
    ],
  );

  const submitTxs = useCallback(async () => {
    const { serviceSend, serviceAccount } = backgroundApiProxy;

    if (sourceInfo) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId,
      });
      if (
        await serviceAccount.checkIsWalletNotBackedUp({
          walletId,
        })
      ) {
        return;
      }
    }

    updateSendTxStatus({ isSubmitting: true });
    // Rotate the submit token so the background retry loop knows which
    // attempt this is and the cancel handler can target it precisely.
    const submitId = generateUUID();
    gasAccountSubmitIdRef.current = submitId;
    // Pre-check before submit

    const accountAddress =
      await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
    try {
      if (
        unsignedTx?.isInternalTransfer &&
        networkId &&
        accountAddress &&
        toAddress
      ) {
        await serviceSend.checkAddressBeforeSending({
          networkId,
          fromAddress: accountAddress,
          toAddress,
        });
      }
      await serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
        feeInfos: sendSelectedFeeInfo?.feeInfos,
      });
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      onFail?.(e as Error);
      isSubmitted.current = false;
      gasAccountSubmitIdRef.current = null;
      void dappApprove.reject(e);
      throw e;
    }

    try {
      const resp =
        await backgroundApiProxy.serviceSignatureConfirm.preActionsBeforeSending(
          {
            accountId,
            networkId,
            unsignedTxs,
            tronResourceRentalInfo,
          },
        );

      if (resp?.preSendTx && accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      }
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      onFail?.(e as Error);
      isSubmitted.current = false;
      gasAccountSubmitIdRef.current = null;
      void dappApprove.reject(e);
      throw e;
    }

    let newUnsignedTxs: IUnsignedTxPro[];
    let nonceInfo: undefined | { nonce: number };

    if (isUndefined(unsignedTxs[0].nonce) && vaultSettings?.nonceRequired) {
      nonceInfo = {
        nonce: await serviceSend.getNextNonce({
          accountId,
          networkId,
          accountAddress,
        }),
      };
    }

    try {
      newUnsignedTxs = await serviceSend.updateUnSignedTxBeforeSending({
        accountId,
        networkId,
        unsignedTxs,
        feeInfos: sendSelectedFeeInfo?.feeInfos,
        nonceInfo: txAdvancedSettings.nonce
          ? { nonce: Number(txAdvancedSettings.nonce) }
          : nonceInfo,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
        feeInfoEditable,
        tronResourceRentalInfo,
      });
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      onFail?.(e as Error);
      isSubmitted.current = false;
      gasAccountSubmitIdRef.current = null;
      void dappApprove.reject(e);
      throw e;
    }

    // fee info pre-check
    if (
      sendSelectedFeeInfo &&
      gasAccountUiState.selectedPayer !== 'gasAccount'
    ) {
      const isFeeInfoOverflow = await checkFeeInfoIsOverflow({
        accountId,
        networkId,
        feeAmount: sendSelectedFeeInfo.feeInfos?.[0]?.totalNative,
        feeSymbol:
          sendSelectedFeeInfo.feeInfos?.[0]?.feeInfo?.common?.nativeSymbol,
        encodedTx: newUnsignedTxs[0].encodedTx,
      });

      if (isFeeInfoOverflow) {
        const isConfirmed = await showFeeInfoOverflowConfirm();
        if (!isConfirmed) {
          isSubmitted.current = false;
          gasAccountSubmitIdRef.current = null;
          updateSendTxStatus({ isSubmitting: false });
          return;
        }
      }
    }

    try {
      let replaceTxInfo: IReplaceTxInfo | undefined;
      if (
        vaultSettings?.replaceTxEnabled &&
        newUnsignedTxs.length === 1 &&
        !isNil(newUnsignedTxs[0].nonce)
      ) {
        const encodedTx = unsignedTxs[0].encodedTx as IEncodedTxEvm;
        const localPendingTxs =
          await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
            accountId,
            networkId,
          });
        const localPendingTxWithSameNonce = localPendingTxs.find((tx) =>
          new BigNumber(tx.decodedTx.nonce).isEqualTo(
            newUnsignedTxs[0].nonce as number,
          ),
        );
        if (localPendingTxWithSameNonce) {
          replaceTxInfo = {
            replaceType:
              new BigNumber(encodedTx.value).isZero() &&
              checkIsEmptyData(encodedTx.data)
                ? EReplaceTxType.Cancel
                : EReplaceTxType.SpeedUp,
            replaceHistoryId: localPendingTxWithSameNonce.id,
          };
        }
      }

      const result =
        await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: newUnsignedTxs,
          feeInfos: sendSelectedFeeInfo?.feeInfos,
          signOnly,
          sourceInfo,
          replaceTxInfo,
          transferPayload,
          successfullySentTxs: successfullySentTxs.current,
          tronResourceRentalInfo,
          gasAccountUiState,
          gasAccountSubmitId: submitId,
          useDefaultRpc: customRpcStatus?.useDefaultRpcOnce,
        });

      // If the user clicked Cancel while `broadcastOnce` was mid-HTTP, the
      // abort signal only unblocks `abortableWait` sleeps — the in-flight
      // request completes normally and we land here with a successful
      // result. `handleOnCancel` already rejected the dApp and nulled the
      // submitId ref, so comparing against the submitId we captured at the
      // start of this attempt is how we detect that race. Skip all success
      // side-effects (toast, dapp resolve, onSuccess, history save,
      // navigation) so the UI stays consistent with the cancel intent.
      // The tx may still land on chain — Prime idempotency prevents any
      // double-charge and the user will see it in their activity.
      if (gasAccountSubmitIdRef.current !== submitId) {
        updateSendTxStatus({ isSubmitting: false });
        setGasAccountRetryState(null);
        isSubmitted.current = false;
        return;
      }

      if (vaultSettings?.afterSendTxActionEnabled) {
        await backgroundApiProxy.serviceSignatureConfirm.afterSendTxAction({
          networkId,
          accountId,
          result,
        });
      }

      const transferInfo = newUnsignedTxs?.[0].transfersInfo?.[0];
      const swapInfo = newUnsignedTxs?.[0].swapInfo;
      const stakingInfo = newUnsignedTxs?.[0].stakingInfo;
      const isTronNetwork = networkUtils.isTronNetworkByNetworkId(networkId);
      defaultLogger.transaction.send.sendConfirm({
        network: networkId,
        txnType: getTxnType({
          actions: result?.[0].decodedTx.actions,
          swapInfo,
          stakingInfo,
        }),
        txnParseType: isUndefined(result?.[0].decodedTx.txParseType)
          ? undefined
          : result?.[0].decodedTx.txParseType,
        txnOrigin: isUndefined(sourceInfo?.origin)
          ? undefined
          : sourceInfo.origin,
        feeToken: isUndefined(sendSelectedFeeInfo?.feeInfos?.[0]?.totalNative)
          ? undefined
          : `${sendSelectedFeeInfo?.feeInfos?.[0]?.totalNative} ${nativeTokenInfo.info?.symbol}`,
        feeFiatValue: isUndefined(sendSelectedFeeInfo?.feeInfos?.[0]?.totalFiat)
          ? undefined
          : `${sendSelectedFeeInfo?.feeInfos?.[0]?.totalFiat} ${settings?.currencyInfo.id}`,
        tokenAddress: transferInfo?.tokenInfo?.address,
        tokenSymbol: transferInfo?.tokenInfo?.symbol,
        tokenType: transferInfo?.nftInfo ? 'NFT' : 'Token',
        interactContract: undefined,
        tronIsResourceRentalNeeded: isTronNetwork
          ? tronResourceRentalInfo?.isResourceRentalNeeded
          : undefined,
        tronIsResourceRentalEnabled: isTronNetwork
          ? tronResourceRentalInfo?.isResourceRentalEnabled
          : undefined,
        tronIsSwapTrxEnabled: isTronNetwork
          ? tronResourceRentalInfo?.isSwapTrxEnabled
          : undefined,
        tronPayCoinCode: isTronNetwork
          ? tronResourceRentalInfo?.payTokenInfo?.symbol
          : undefined,
        tronUseCredit: isTronNetwork
          ? tronResourceRentalInfo?.isResourceClaimed
          : undefined,
        tronUseRedemptionCode: isTronNetwork
          ? tronResourceRentalInfo?.isResourceRedeemed
          : undefined,
        tronIsCreditAutoClaimed: isTronNetwork
          ? transferPayload?.isTronResourceAutoClaimed
          : undefined,
      });

      Toast.success({
        title: isFeeSponsored
          ? intl.formatMessage({
              id: ETranslations.wallet_gas_sponsored_transaction_submitted__msg,
            })
          : intl.formatMessage({
              id: ETranslations.feedback_transaction_submitted,
            }),
        icon: isFeeSponsored ? 'GiftSolid' : undefined,
      });

      const signedTx = result[0].signedTx;

      isSubmitted.current = true;
      gasAccountSubmitIdRef.current = null;

      void dappApprove.resolve({ result: signedTx });

      if (accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      }

      updateSendTxStatus({ isSubmitting: false });
      onSuccess?.(result);

      // Save recent recipient for all transfer types
      const isLightningNetwork =
        networkUtils.isLightningNetworkByNetworkId(networkId);
      let addressToSave: undefined | string | null =
        transferPayload?.originalRecipient;

      if (isLightningNetwork) {
        addressToSave = (unsignedTxs[0].encodedTx as IEncodedTxLightning)
          ?.lightningAddress;

        if (!addressToSave) {
          addressToSave = transferInfo?.lnurl;
        }
      }

      // Fallback to transferInfo.to only for send flows (transferPayload present)
      // to avoid saving contract addresses from dApp interactions
      if (!addressToSave && transferInfo?.to && transferPayload) {
        addressToSave = transferInfo.to;
      }

      if (addressToSave) {
        void backgroundApiProxy.serviceSignatureConfirm.updateRecentRecipients({
          networkId,
          accountId,
          address: addressToSave,
          memo:
            transferPayload?.memo ||
            transferPayload?.note ||
            (transferPayload?.paymentId
              ? String(transferPayload.paymentId)
              : undefined),
        });
      }

      if (isQueueMode && unsignedTxQueue && unsignedTxQueue.size > 1) {
        unsignedTxQueue.removeCurrent();
        if (unsignedTxQueue.current) {
          updateUnsignedTxs([unsignedTxQueue.current]);
        }
        return;
      }

      if (popStack) {
        navigation.popStack();
      } else {
        navigation.pop();
      }
    } catch (e: any) {
      // User aborted a 90212 retry via Cancel: modal is closing, dappApprove
      // was already rejected in handleOnCancel. Skip toast, skip re-estimate,
      // skip dappApprove propagation — just unwind submit state.
      if (isGasAccountSubmitCancelledError(e)) {
        muteHandledErrorToast(e);
        updateSendTxStatus({ isSubmitting: false });
        setGasAccountRetryState(null);
        isSubmitted.current = false;
        gasAccountSubmitIdRef.current = null;
        return;
      }
      const gasAccountStrategy = handleGasAccountSubmitError(e);
      // Refresh and Fallback both keep the user on the confirm page with a
      // fresh estimate in flight, so the dApp caller should also keep waiting.
      // Hint is terminal for this attempt — propagate to onFail / dApp reject
      // so callers aren't left pending indefinitely.
      if (
        gasAccountStrategy === EGasAccountErrorStrategy.Refresh ||
        gasAccountStrategy === EGasAccountErrorStrategy.Fallback
      ) {
        updateSendTxStatus({ isSubmitting: false });
        isSubmitted.current = false;
        gasAccountSubmitIdRef.current = null;
        return;
      }
      if (accountUtils.isQrAccount({ accountId })) {
        navigation.popStack();
      }
      updateSendTxStatus({ isSubmitting: false });
      // show toast by @toastIfError() in background method
      // Toast.error({
      //   title: (e as Error).message,
      // });
      onFail?.(e as Error);
      isSubmitted.current = false;
      gasAccountSubmitIdRef.current = null;
      if (shouldRejectDappAction()) {
        void dappApprove.reject(e);
      }
      throw e;
    }
  }, [
    sourceInfo,
    updateSendTxStatus,
    accountId,
    networkId,
    unsignedTxs,
    vaultSettings?.nonceRequired,
    vaultSettings?.replaceTxEnabled,
    vaultSettings?.afterSendTxActionEnabled,
    sendSelectedFeeInfo,
    gasAccountUiState,
    unsignedTx?.isInternalTransfer,
    toAddress,
    nativeTokenTransferAmountToUpdate.isMaxSend,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    onFail,
    dappApprove,
    tronResourceRentalInfo,
    navigation,
    txAdvancedSettings.nonce,
    feeInfoEditable,
    checkFeeInfoIsOverflow,
    showFeeInfoOverflowConfirm,
    signOnly,
    transferPayload,
    handleGasAccountSubmitError,
    intl,
    onSuccess,
    isQueueMode,
    unsignedTxQueue,
    popStack,
    updateUnsignedTxs,
    shouldRejectDappAction,
    customRpcStatus?.useDefaultRpcOnce,
    settings?.currencyInfo.id,
    nativeTokenInfo.info?.symbol,
    isFeeSponsored,
  ]);

  const handleOnConfirm = useCallback(async () => {
    if (decodedTxs[0]?.isCustomHexData) {
      showCustomHexDataAlert({
        decodedTx: decodedTxs[0],
        toAddress: transferPayload?.originalRecipient ?? decodedTxs[0].to ?? '',
        onConfirm: async () => {
          await submitTxs();
        },
      });
    } else {
      await submitTxs();
    }
  }, [decodedTxs, submitTxs, transferPayload?.originalRecipient]);

  const cancelCalledRef = useRef(false);
  // If a 90212 retry loop is in flight, tear it down before the flow
  // unwinds. Otherwise the background would keep sleeping/broadcasting
  // after the user already chose to abandon — with Prime idempotency it
  // wouldn't double-charge, but the tx could still land on-chain after
  // the dApp saw a rejection, which is the UX we're explicitly avoiding.
  // Shared between the explicit Cancel button and `usePageUnMounted`, so
  // system-back / popStack paths also tear down the loop.
  const abortPendingGasAccountSubmit = useCallback(() => {
    const pendingSubmitId = gasAccountSubmitIdRef.current;
    if (pendingSubmitId) {
      gasAccountSubmitIdRef.current = null;
      void backgroundApiProxy.serviceSend.abortGasAccountSubmit(
        pendingSubmitId,
      );
    }
  }, []);
  const onCancelOnce = useCallback(() => {
    if (cancelCalledRef.current) {
      return;
    }
    cancelCalledRef.current = true;
    abortPendingGasAccountSubmit();
    onCancel?.();
  }, [abortPendingGasAccountSubmit, onCancel]);

  const handleOnCancel = useCallback(
    (close: () => void, closePageStack: () => void) => {
      if (isQueueMode && unsignedTxQueue && unsignedTxQueue.size > 1) {
        unsignedTxQueue.removeCurrent();
        if (unsignedTxQueue.current) {
          updateUnsignedTxs([unsignedTxQueue.current]);
        }
        return;
      }

      abortPendingGasAccountSubmit();

      dappApprove.reject();
      if (!sourceInfo) {
        closePageStack();
      } else {
        close();
      }
      onCancelOnce();
    },
    [
      abortPendingGasAccountSubmit,
      dappApprove,
      isQueueMode,
      onCancelOnce,
      sourceInfo,
      unsignedTxQueue,
      updateUnsignedTxs,
    ],
  );

  const showTakeRiskAlert = useMemo(() => {
    if (decodedTxs?.some((tx) => tx.isConfirmationRequired)) return true;
    return false;
  }, [decodedTxs]);

  const isGasAccountQuoteExpired = useMemo(() => {
    if (gasAccountUiState.selectedPayer !== 'gasAccount') {
      return false;
    }

    const expiresAt = gasAccountUiState.gasAccountQuote?.expiresAt;
    // Treat missing or invalid `expiresAt` as "no client-side expiry
    // signal" rather than "already expired". Otherwise the expiry
    // `useEffect` would auto-reset + re-estimate; if the server keeps
    // returning quotes with an empty or invalid expiresAt, the
    // `quoteExpiredHandledRef` reset path creates an infinite loop of
    // network requests and UI flicker. Falling through to the submit
    // flow lets the backend reject (routed through handleGasAccountSubmitError)
    // or succeed — which requires user action and cannot auto-loop.
    if (!expiresAt) {
      return false;
    }

    const numericValue = Number(expiresAt);
    let expiresAtMs = new Date(expiresAt).getTime();
    if (Number.isFinite(numericValue)) {
      expiresAtMs =
        numericValue > 10 ** 12 ? numericValue : numericValue * 1000;
    }
    if (!Number.isFinite(expiresAtMs)) {
      return false;
    }

    return expiresAtMs <= gasAccountNow;
  }, [
    gasAccountNow,
    gasAccountUiState.gasAccountQuote?.expiresAt,
    gasAccountUiState.selectedPayer,
  ]);

  useInterval(
    () => {
      setGasAccountNow(Date.now());
    },
    gasAccountUiState.selectedPayer === 'gasAccount' ||
      gasAccountRetryState !== null
      ? 1000
      : null,
  );

  // Gate by the local `isSubmitting` state to ignore orphan retry events
  // from another TxConfirmActions instance whose background loop is still
  // running (e.g. stacked confirm flows, side panel, tablet detail view).
  // `Cleared` is idempotent so we don't gate it — worst case it clears an
  // already-null state.
  const isSubmittingRef = useRef(sendTxStatus.isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = sendTxStatus.isSubmitting;
  }, [sendTxStatus.isSubmitting]);

  useEffect(() => {
    const onScheduled = (payload: {
      attempt: number;
      maxAttempts: number;
      retryAfterSec: number;
      scheduledAt: number;
    }) => {
      if (!isSubmittingRef.current) return;
      setGasAccountRetryState(payload);
      setGasAccountNow(Date.now());
    };
    const onCleared = () => {
      setGasAccountRetryState(null);
    };
    appEventBus.on(
      EAppEventBusNames.GasAccountSubmitRetryScheduled,
      onScheduled,
    );
    appEventBus.on(EAppEventBusNames.GasAccountSubmitRetryCleared, onCleared);
    return () => {
      appEventBus.off(
        EAppEventBusNames.GasAccountSubmitRetryScheduled,
        onScheduled,
      );
      appEventBus.off(
        EAppEventBusNames.GasAccountSubmitRetryCleared,
        onCleared,
      );
    };
  }, []);

  const gasAccountRetryRemainingSec = useMemo(() => {
    if (!gasAccountRetryState) return 0;
    const dueAt =
      gasAccountRetryState.scheduledAt +
      gasAccountRetryState.retryAfterSec * 1000;
    return Math.max(0, Math.ceil((dueAt - gasAccountNow) / 1000));
  }, [gasAccountRetryState, gasAccountNow]);

  // Safety net in case the `Cleared` event is dropped (e.g. transport hiccup
  // between bg and ui). The retry loop only runs while `isSubmitting` is true,
  // so any false transition is a terminal signal for the current submit.
  useEffect(() => {
    if (!sendTxStatus.isSubmitting && gasAccountRetryState) {
      setGasAccountRetryState(null);
    }
  }, [sendTxStatus.isSubmitting, gasAccountRetryState]);

  // When the quote expires while the user is still on the confirm page, kick
  // off a silent re-estimate instead of leaving the submit button disabled
  // indefinitely. The ref gates this to a single shot per expiry transition.
  const quoteExpiredHandledRef = useRef(false);
  useEffect(() => {
    if (isGasAccountQuoteExpired) {
      if (quoteExpiredHandledRef.current) return;
      quoteExpiredHandledRef.current = true;
      resetGasAccountUiState();
      updateTxFeeInfoInit(false);
      appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
    } else {
      quoteExpiredHandledRef.current = false;
    }
  }, [isGasAccountQuoteExpired, resetGasAccountUiState, updateTxFeeInfoInit]);

  const isConfirmInitializing = useMemo(
    () => !txFeeInfoInit || !decodedTxsInit || isBuildingDecodedTxs,
    [txFeeInfoInit, decodedTxsInit, isBuildingDecodedTxs],
  );

  const isSubmitDisabled = useMemo(() => {
    if (!txFeeInfoInit || !decodedTxsInit) return true;

    if (showTakeRiskAlert && !continueOperate) return true;

    if (sendTxStatus.isSubmitting) return true;
    if (
      nativeTokenInfo.isLoading ||
      sendTxStatus.isInsufficientNativeBalance ||
      sendTxStatus.isInsufficientTokenBalance
    )
      return true;
    if (isBuildingDecodedTxs) return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.errMessage) return true;
    if (isGasAccountQuoteExpired) return true;
    if (preCheckTxStatus.errorMessage) return true;
    if (txAdvancedSettings.dataChanged) return true;
    // Disable if custom RPC is unavailable AND user hasn't chosen to use OneKey RPC
    if (
      customRpcStatus?.isCustomRpcUnavailable &&
      !customRpcStatus?.useDefaultRpcOnce
    )
      return true;
    return false;
  }, [
    txFeeInfoInit,
    decodedTxsInit,
    showTakeRiskAlert,
    continueOperate,
    sendTxStatus.isSubmitting,
    sendTxStatus.isInsufficientNativeBalance,
    sendTxStatus.isInsufficientTokenBalance,
    nativeTokenInfo.isLoading,
    isBuildingDecodedTxs,
    sendSelectedFeeInfo,
    sendFeeStatus.errMessage,
    isGasAccountQuoteExpired,
    preCheckTxStatus.errorMessage,
    txAdvancedSettings.dataChanged,
    customRpcStatus?.isCustomRpcUnavailable,
    customRpcStatus?.useDefaultRpcOnce,
  ]);

  usePageUnMounted(() => {
    if (!isSubmitted.current) {
      onCancelOnce();
    }
  });

  const confirmText = useMemo(() => {
    if (gasAccountRetryState && gasAccountRetryRemainingSec > 0) {
      return intl.formatMessage(
        {
          id: ETranslations.wallet_gas_sponsor_retrying_in_seconds__desc,
        },
        {
          seconds: gasAccountRetryRemainingSec,
        },
      );
    }

    if (signOnly) {
      return intl.formatMessage({ id: ETranslations.global_sign });
    }

    if (isFeeSponsored) {
      return intl.formatMessage({ id: ETranslations.wallet_send_free });
    }

    if (sendFeeStatus.discountPercent === 100) {
      return intl.formatMessage({ id: ETranslations.wallet_send_free });
    }

    if (sendFeeStatus.discountPercent && sendFeeStatus.discountPercent > 0) {
      return intl.formatMessage({
        id: ETranslations.wallet_discounted_send,
      });
    }

    return intl.formatMessage({ id: ETranslations.global_confirm });
  }, [
    gasAccountRetryState,
    gasAccountRetryRemainingSec,
    intl,
    isFeeSponsored,
    sendFeeStatus.discountPercent,
    signOnly,
  ]);

  return (
    <Page.Footer disableKeyboardAnimation>
      <Page.FooterActions
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: sendTxStatus.isSubmitting || isConfirmInitializing,
          variant: showTakeRiskAlert ? 'destructive' : 'primary',
        }}
        cancelButtonProps={{
          // Keep Cancel enabled during the 90212 retry wait so the user can
          // abandon the flow instead of being parked on a disabled screen for
          // up to 3 × retryAfterSec. The background retry loop is not torn
          // down (handoff §10.2 allows background completion), but the user
          // regains control of the UI.
          disabled: sendTxStatus.isSubmitting && gasAccountRetryState === null,
        }}
        onConfirmText={confirmText}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
        {...(bottom && {
          mb: bottom,
        })}
      >
        <Stack
          gap="$2.5"
          pb="$5"
          $gtMd={{
            pb: '$0',
          }}
        >
          <TxFeeInfo
            accountId={accountId}
            networkId={networkId}
            useFeeInTx={useFeeInTx}
            feeInfoEditable={feeInfoEditable}
            transferPayload={transferPayload}
            gasAccountScenario={gasAccountScenario}
          />
          {showTakeRiskAlert ? (
            <Checkbox
              label={intl.formatMessage({
                id: ETranslations.dapp_connect_proceed_at_my_own_risk,
              })}
              value={continueOperate}
              onChange={(checked) => {
                setContinueOperate(!!checked);
              }}
            />
          ) : null}
        </Stack>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(TxConfirmActions);
