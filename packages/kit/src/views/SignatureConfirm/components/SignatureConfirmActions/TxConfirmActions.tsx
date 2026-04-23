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
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsEmptyData } from '@onekeyhq/shared/src/utils/evmUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getTxnType } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';
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

function getGasAccountErrorCode(error: unknown) {
  // OneKey RPC errors surface as `{ data: { data: { res: { error: { code } } } } }`
  // (see `IOneKeyRpcError` in shared/errors/types). Older non-RPC paths expose
  // `.code` directly or at `.data.code` / `.data.data.code`, so probe all four.
  const e = error as
    | (IOneKeyError & {
        data?: {
          code?: number;
          data?: {
            code?: number;
            res?: { error?: { code?: number } };
          };
        };
      })
    | undefined;

  if (typeof e?.code === 'number') {
    return e.code;
  }
  const errorDataCode = e?.data?.code;
  if (typeof errorDataCode === 'number') {
    return errorDataCode;
  }
  const nestedErrorDataCode = e?.data?.data?.code;
  if (typeof nestedErrorDataCode === 'number') {
    return nestedErrorDataCode;
  }
  const rpcErrorCode = e?.data?.data?.res?.error?.code;
  if (typeof rpcErrorCode === 'number') {
    return rpcErrorCode;
  }

  return undefined;
}

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
  const { bottom } = useSafeAreaInsets();
  const [tronResourceRentalInfo] = useTronResourceRentalInfoAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
  const [decodedTxsInit] = useDecodedTxsInitAtom();
  const [customRpcStatus] = useCustomRpcStatusAtom();
  const [settings] = useSettingsPersistAtom();
  const [gasAccountNow, setGasAccountNow] = useState(Date.now());

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

      const message =
        entry.message ??
        (error as Error | undefined)?.message ??
        'Failed to submit transaction.';

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
        Toast.warning({ title: message });
        appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
        return EGasAccountErrorStrategy.Fallback;
      }

      // Hint: suppress the generic toast, show our specific copy, but let the
      // caller still invoke onFail / dappApprove.reject — the current attempt
      // is terminal and the dApp needs to know.
      muteHandledErrorToast(error);
      Toast.warning({ title: message });
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
          useDefaultRpc: customRpcStatus?.useDefaultRpcOnce,
        });

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
          ? 'Gas-sponsored transaction submitted'
          : intl.formatMessage({
              id: ETranslations.feedback_transaction_submitted,
            }),
        icon: isFeeSponsored ? 'GiftSolid' : undefined,
      });

      const signedTx = result[0].signedTx;

      isSubmitted.current = true;

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
  const onCancelOnce = useCallback(() => {
    if (cancelCalledRef.current) {
      return;
    }
    cancelCalledRef.current = true;
    onCancel?.();
  }, [onCancel]);

  const handleOnCancel = useCallback(
    (close: () => void, closePageStack: () => void) => {
      if (isQueueMode && unsignedTxQueue && unsignedTxQueue.size > 1) {
        unsignedTxQueue.removeCurrent();
        if (unsignedTxQueue.current) {
          updateUnsignedTxs([unsignedTxQueue.current]);
        }
        return;
      }

      dappApprove.reject();
      if (!sourceInfo) {
        closePageStack();
      } else {
        close();
      }
      onCancelOnce();
    },
    [
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
    gasAccountUiState.selectedPayer === 'gasAccount' ? 1000 : null,
  );

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
  }, [intl, isFeeSponsored, sendFeeStatus.discountPercent, signOnly]);

  return (
    <Page.Footer disableKeyboardAnimation>
      <Page.FooterActions
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: sendTxStatus.isSubmitting || isConfirmInitializing,
          variant: showTakeRiskAlert ? 'destructive' : 'primary',
        }}
        cancelButtonProps={{
          disabled: sendTxStatus.isSubmitting,
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
