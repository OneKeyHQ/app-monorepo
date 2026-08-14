import { useMemo } from 'react';

import {
  useEffectiveFeePayerAtom,
  useExtraFeeInfoAtom,
  useGasAccountTemporarilyDisabledAtom,
  useGasAccountUiStateAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useTxFeeInfoInitAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IGasAccountAnalyticsContext } from '@onekeyhq/shared/src/logger/scopes/transaction/types';
import {
  ESendFeeStatus,
  GAS_ACCOUNT_DISABLED_SCENARIOS,
  type IGasAccountDisabledScenario,
  type IGasAccountScenario,
} from '@onekeyhq/shared/types/fee';

import { buildGasAccountAnalyticsContext } from '../utils/gasAccountAnalytics';

export function useGasAccountAnalyticsContext({
  networkId,
  gasAccountScenario,
  isPrivateSend,
}: {
  networkId: string;
  gasAccountScenario: IGasAccountScenario | undefined;
  isPrivateSend: boolean;
}): IGasAccountAnalyticsContext | undefined {
  const [settings] = useSettingsPersistAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [extraFeeInfo] = useExtraFeeInfoAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [gasAccountUiState] = useGasAccountUiStateAtom();
  const [effectiveFeePayer] = useEffectiveFeePayerAtom();
  const [gasAccountTemporarilyDisabled] =
    useGasAccountTemporarilyDisabledAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();

  return useMemo(() => {
    if (
      !txFeeInfoInit ||
      sendFeeStatus.status !== ESendFeeStatus.Success ||
      !sendSelectedFeeInfo ||
      nativeTokenInfo.isLoading
    ) {
      return undefined;
    }

    const disabledByScenario = GAS_ACCOUNT_DISABLED_SCENARIOS.includes(
      gasAccountScenario as IGasAccountDisabledScenario,
    );
    const disabledForBatch = unsignedTxs.length > 1;
    const disabledByCustomRpc = gasAccountUiState.sponsorDisabledByCustomRpc;
    const clientUnsupported =
      disabledByScenario ||
      isPrivateSend ||
      disabledForBatch ||
      disabledByCustomRpc;
    const gasAccountRequested =
      settings.useGasAccountByDefault !== false &&
      !clientUnsupported &&
      !gasAccountTemporarilyDisabled;
    const hasEligibleQuote = Boolean(
      gasAccountUiState.gasAccountEligible &&
      gasAccountUiState.gasAccountQuote?.quoteId,
    );
    const gasAccountEligible = gasAccountRequested ? hasEligibleQuote : null;
    let gasAccountSupported: boolean | null = null;
    if (hasEligibleQuote) {
      gasAccountSupported = true;
    } else if (
      clientUnsupported ||
      gasAccountUiState.gasAccountScenarioReason
    ) {
      gasAccountSupported = false;
    }

    let unavailableReason: string | undefined;
    if (!hasEligibleQuote) {
      if (settings.useGasAccountByDefault === false) {
        unavailableReason = 'userDisabled';
      } else if (disabledByCustomRpc) {
        unavailableReason = 'customRpcEnabled';
      } else if (disabledByScenario) {
        unavailableReason = 'unsupportedScenario';
      } else if (isPrivateSend) {
        unavailableReason = 'privateSend';
      } else if (disabledForBatch) {
        unavailableReason = 'batchTransaction';
      } else if (gasAccountTemporarilyDisabled) {
        unavailableReason = 'temporarilyDisabled';
      } else {
        unavailableReason =
          gasAccountUiState.gasAccountScenarioReason ?? 'backend_unknown';
      }
    }

    const nativeTokenPrice =
      sendSelectedFeeInfo.feeInfos[0]?.feeInfo.common?.nativeTokenPrice;

    return buildGasAccountAnalyticsContext({
      entryPoint: 'txConfirm',
      network: networkId,
      scenario: gasAccountScenario,
      gasAccountRequested,
      gasAccountSupported,
      gasAccountEligible,
      selectedPayer: gasAccountUiState.selectedPayer ?? 'user',
      effectiveFeePayer,
      unavailableReason,
      estimatedGasNative:
        sendSelectedFeeInfo.originalTotalNative ??
        sendSelectedFeeInfo.totalNative,
      nativeBalance: nativeTokenInfo.balance,
      nativePrincipal: nativeTokenTransferAmountToUpdate.amountToUpdate,
      extraFeeNative: extraFeeInfo.feeNative,
      nativeTokenPrice,
      fiatCurrency: settings.currencyInfo.id,
      tokenPrincipalInsufficient: Boolean(
        sendTxStatus.isInsufficientTokenBalance,
      ),
      quoteId: gasAccountUiState.gasAccountQuote?.quoteId,
    });
  }, [
    effectiveFeePayer,
    extraFeeInfo.feeNative,
    gasAccountScenario,
    gasAccountTemporarilyDisabled,
    gasAccountUiState.gasAccountEligible,
    gasAccountUiState.gasAccountQuote?.quoteId,
    gasAccountUiState.gasAccountScenarioReason,
    gasAccountUiState.selectedPayer,
    gasAccountUiState.sponsorDisabledByCustomRpc,
    isPrivateSend,
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    networkId,
    sendSelectedFeeInfo,
    sendFeeStatus.status,
    sendTxStatus.isInsufficientTokenBalance,
    settings.currencyInfo.id,
    settings.useGasAccountByDefault,
    txFeeInfoInit,
    unsignedTxs.length,
  ]);
}
