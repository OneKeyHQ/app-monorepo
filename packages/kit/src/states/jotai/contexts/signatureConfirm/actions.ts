import { useRef } from 'react';

import { isUndefined, omitBy } from 'lodash';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { ETronResourceRentalPayType } from '@onekeyhq/shared/types/fee';
import type {
  EFeeType,
  ESendFeeStatus,
  IFeeInfoUnit,
  IGasAccountQuote,
  IGasPayer,
  ISendSelectedFeeInfo,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  type ICustomRpcStatusAtomValue,
  contextAtomMethod,
  customFeeAtom,
  customRpcStatusAtom,
  decodedTxsAtom,
  decodedTxsInitAtom,
  defaultEffectiveFeePayer,
  defaultGasAccountUiState,
  defaultMegafuelEligible,
  defaultPayWithTokenInfo,
  defaultSendFeeStatus,
  defaultSendSelectedFee,
  defaultTronResourceRentalInfo,
  effectiveFeePayerAtom,
  extraFeeInfoAtom,
  gasAccountTemporarilyDisabledAtom,
  gasAccountUiStateAtom,
  isSinglePresetAtom,
  megafuelEligibleAtom,
  nativeTokenInfoAtom,
  nativeTokenTransferAmountAtom,
  nativeTokenTransferAmountToUpdateAtom,
  payWithTokenInfoAtom,
  preCheckTxStatusAtom,
  sendFeeStatusAtom,
  sendSelectedFeeAtom,
  sendSelectedFeeInfoAtom,
  sendTxStatusAtom,
  tokenApproveInfoAtom,
  tokenTransferAmountAtom,
  tronResourceRentalInfoAtom,
  txAdvancedSettingsAtom,
  txFeeInfoInitAtom,
  unsignedTxsAtom,
} from './atoms';

class ContextJotaiActionsSignatureConfirm extends ContextJotaiActionsBase {
  updateIsSinglePreset = contextAtomMethod(
    (get, set, isSinglePreset: boolean) => {
      set(isSinglePresetAtom(), isSinglePreset);
    },
  );

  updateUnsignedTxs = contextAtomMethod(
    (get, set, unsignedTxs: IUnsignedTxPro[]) => {
      set(unsignedTxsAtom(), unsignedTxs);
    },
  );

  updateDecodedTxs = contextAtomMethod(
    (
      get,
      set,
      params: {
        decodedTxs?: IDecodedTx[];
        isBuildingDecodedTxs?: boolean;
      },
    ) => {
      set(decodedTxsAtom(), {
        ...get(decodedTxsAtom()),
        ...params,
      });
    },
  );

  updateSendSelectedFee = contextAtomMethod(
    (
      get,
      set,
      sendSelectedFee: {
        feeType?: EFeeType;
        presetIndex?: number;
        source?: 'dapp' | 'wallet';
      },
    ) => {
      set(sendSelectedFeeAtom(), {
        ...get(sendSelectedFeeAtom()),
        ...sendSelectedFee,
        source: sendSelectedFee.source ?? 'wallet',
      });
    },
  );

  updateCustomFee = contextAtomMethod((get, set, customFee: IFeeInfoUnit) => {
    set(customFeeAtom(), customFee);
  });

  clearCustomFee = contextAtomMethod((_, set) => {
    set(customFeeAtom(), undefined);
  });

  updateSendSelectedFeeInfo = contextAtomMethod(
    (
      get,
      set,
      payload: {
        feeInfos: ISendSelectedFeeInfo[];
        total: string;
        totalNative: string;
        totalFiat: string;
        totalNativeForDisplay: string;
        totalFiatForDisplay: string;
        originalTotalNative?: string;
        originalTotalFiat?: string;
      },
    ) => {
      set(sendSelectedFeeInfoAtom(), payload);
    },
  );

  clearSendSelectedFeeInfo = contextAtomMethod((_, set) => {
    set(sendSelectedFeeInfoAtom(), undefined);
  });

  updateSendFeeStatus = contextAtomMethod(
    (
      get,
      set,
      payload: {
        status?: ESendFeeStatus;
        errMessage?: string;
        discountPercent?: number;
      },
    ) => {
      set(sendFeeStatusAtom(), {
        ...get(sendFeeStatusAtom()),
        ...payload,
      });
    },
  );

  resetSendFeeStatus = contextAtomMethod((_, set) => {
    set(sendFeeStatusAtom(), { ...defaultSendFeeStatus });
  });

  updateNativeTokenTransferAmount = contextAtomMethod(
    (get, set, amount: string) => {
      set(nativeTokenTransferAmountAtom(), amount);
    },
  );

  updateNativeTokenTransferAmountToUpdate = contextAtomMethod(
    (get, set, payload: { isMaxSend: boolean; amountToUpdate: string }) => {
      set(nativeTokenTransferAmountToUpdateAtom(), payload);
    },
  );

  updateNativeTokenInfo = contextAtomMethod(
    (
      get,
      set,
      payload: {
        logoURI: string;
        balance: string;
        isLoading: boolean;
        info: IToken | undefined;
      },
    ) => {
      set(nativeTokenInfoAtom(), payload);
    },
  );

  updateSendTxStatus = contextAtomMethod(
    (
      get,
      set,
      status: {
        isInsufficientNativeBalance?: boolean;
        isInsufficientTokenBalance?: boolean;
        fillUpTokenBalance?: string;
        isSubmitting?: boolean;
        isSendNativeTokenOnly?: boolean;
        fillUpNativeBalance?: string;
        maxFeeNative?: string;
        isBaseOnEstimateMaxFee?: boolean;
      },
    ) => {
      set(sendTxStatusAtom(), {
        ...get(sendTxStatusAtom()),
        ...status,
      });
    },
  );

  updatePreCheckTxStatus = contextAtomMethod((_, set, errorMessage: string) => {
    set(preCheckTxStatusAtom(), { errorMessage });
  });

  updateTokenApproveInfo = contextAtomMethod(
    (
      get,
      set,
      payload: {
        originalAllowance: string;
        originalIsUnlimited: boolean;
      },
    ) => {
      const tokenApproveInfo = get(tokenApproveInfoAtom());
      if (tokenApproveInfo.originalAllowance !== '') {
        return;
      }

      set(tokenApproveInfoAtom(), payload);
    },
  );

  updateTxAdvancedSettings = contextAtomMethod(
    (get, set, payload: { nonce?: string; dataChanged?: boolean }) => {
      set(txAdvancedSettingsAtom(), {
        ...get(txAdvancedSettingsAtom()),
        ...payload,
      });
    },
  );

  updateExtraFeeInfo = contextAtomMethod(
    (get, set, payload: { feeNative: string }) => {
      set(extraFeeInfoAtom(), payload);
    },
  );

  updateTronResourceRentalInfo = contextAtomMethod(
    (get, set, payload: Partial<ITronResourceRentalInfo>) => {
      set(tronResourceRentalInfoAtom(), {
        ...get(tronResourceRentalInfoAtom()),
        ...omitBy(payload, isUndefined),
      });

      const updatedTronResourceRentalInfo = get(tronResourceRentalInfoAtom());

      if (
        updatedTronResourceRentalInfo.isResourceRentalNeeded === false ||
        updatedTronResourceRentalInfo.isResourceRentalEnabled === false ||
        updatedTronResourceRentalInfo.payType ===
          ETronResourceRentalPayType.Native
      ) {
        set(payWithTokenInfoAtom(), {
          ...get(payWithTokenInfoAtom()),
          enabled: false,
        });
      } else if (
        updatedTronResourceRentalInfo.isResourceRentalNeeded === true &&
        updatedTronResourceRentalInfo.isResourceRentalEnabled === true &&
        updatedTronResourceRentalInfo.payType ===
          ETronResourceRentalPayType.Token
      ) {
        set(payWithTokenInfoAtom(), {
          ...get(payWithTokenInfoAtom()),
          enabled: true,
        });
      }
    },
  );

  resetTronResourceRentalInfo = contextAtomMethod((_, set) => {
    set(tronResourceRentalInfoAtom(), {
      ...defaultTronResourceRentalInfo,
    });
  });

  updatePayWithTokenInfo = contextAtomMethod(
    (
      get,
      set,
      payload: {
        enabled?: boolean;
        address?: string;
        balance?: string;
        symbol?: string;
        logoURI?: string;
        isLoading?: boolean;
      },
    ) => {
      set(payWithTokenInfoAtom(), {
        ...get(payWithTokenInfoAtom()),
        ...payload,
      });
    },
  );

  resetPayWithTokenInfo = contextAtomMethod((_, set) => {
    set(payWithTokenInfoAtom(), { ...defaultPayWithTokenInfo });
  });

  updateTokenTransferAmount = contextAtomMethod((get, set, amount: string) => {
    set(tokenTransferAmountAtom(), amount);
  });

  updateMegafuelEligible = contextAtomMethod(
    (
      get,
      set,
      payload: {
        sponsorable?: boolean;
        sponsorName?: string;
      },
    ) => {
      const megafuelEligible = get(megafuelEligibleAtom());
      set(megafuelEligibleAtom(), {
        ...megafuelEligible,
        ...payload,
      });
    },
  );

  resetMegafuelEligible = contextAtomMethod((_, set) => {
    set(megafuelEligibleAtom(), { ...defaultMegafuelEligible });
  });

  updateEffectiveFeePayer = contextAtomMethod((_, set, payer: IGasPayer) => {
    set(effectiveFeePayerAtom(), payer);
  });

  resetEffectiveFeePayer = contextAtomMethod((_, set) => {
    set(effectiveFeePayerAtom(), defaultEffectiveFeePayer);
  });

  updateGasAccountUiState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        payer?: IGasPayer;
        gasAccountEligible?: boolean;
        gasAccountQuote?: IGasAccountQuote;
        selectedPayer?: 'user' | 'gasAccount';
        lockedUserNonce?: number;
        idempotencyKey?: string;
        gasAccountScenarioReason?: string;
      },
    ) => {
      set(gasAccountUiStateAtom(), {
        ...get(gasAccountUiStateAtom()),
        ...omitBy(payload, isUndefined),
      });
    },
  );

  resetGasAccountUiState = contextAtomMethod((_, set) => {
    set(gasAccountUiStateAtom(), { ...defaultGasAccountUiState });
  });

  updateGasAccountTemporarilyDisabled = contextAtomMethod(
    (_, set, disabled: boolean) => {
      set(gasAccountTemporarilyDisabledAtom(), disabled);
    },
  );

  resetGasAccountTemporarilyDisabled = contextAtomMethod((_, set) => {
    set(gasAccountTemporarilyDisabledAtom(), false);
  });

  updateDecodedTxsInit = contextAtomMethod(
    (_, set, decodedTxsInit: boolean) => {
      set(decodedTxsInitAtom(), decodedTxsInit);
    },
  );

  updateTxFeeInfoInit = contextAtomMethod((_, set, txFeeInfoInit: boolean) => {
    set(txFeeInfoInitAtom(), txFeeInfoInit);
  });

  resetTxFeeState = contextAtomMethod((_, set, presetIndex: number = 0) => {
    set(sendSelectedFeeAtom(), {
      ...defaultSendSelectedFee,
      presetIndex,
    });
    set(customFeeAtom(), undefined);
    set(sendSelectedFeeInfoAtom(), undefined);
    set(sendFeeStatusAtom(), { ...defaultSendFeeStatus });
    set(tronResourceRentalInfoAtom(), {
      ...defaultTronResourceRentalInfo,
    });
    set(payWithTokenInfoAtom(), { ...defaultPayWithTokenInfo });
    set(megafuelEligibleAtom(), { ...defaultMegafuelEligible });
    set(effectiveFeePayerAtom(), defaultEffectiveFeePayer);
    set(gasAccountUiStateAtom(), { ...defaultGasAccountUiState });
    set(gasAccountTemporarilyDisabledAtom(), false);
    set(txFeeInfoInitAtom(), false);
  });

  updateCustomRpcStatus = contextAtomMethod(
    (get, set, value: ICustomRpcStatusAtomValue | null) => {
      set(customRpcStatusAtom(), value);
    },
  );

  clearCustomRpcStatus = contextAtomMethod((get, set) => {
    set(customRpcStatusAtom(), null);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsSignatureConfirm()', Date.now());
  return new ContextJotaiActionsSignatureConfirm();
});

export function useSignatureConfirmActions() {
  const actions = createActions();
  const updateUnsignedTxs = actions.updateUnsignedTxs.use();
  const updateSendSelectedFee = actions.updateSendSelectedFee.use();
  const updateCustomFee = actions.updateCustomFee.use();
  const clearCustomFee = actions.clearCustomFee.use();
  const updateSendSelectedFeeInfo = actions.updateSendSelectedFeeInfo.use();
  const clearSendSelectedFeeInfo = actions.clearSendSelectedFeeInfo.use();
  const updateSendFeeStatus = actions.updateSendFeeStatus.use();
  const resetSendFeeStatus = actions.resetSendFeeStatus.use();
  const updateNativeTokenTransferAmount =
    actions.updateNativeTokenTransferAmount.use();
  const updateNativeTokenTransferAmountToUpdate =
    actions.updateNativeTokenTransferAmountToUpdate.use();
  const updateSendTxStatus = actions.updateSendTxStatus.use();
  const updateNativeTokenInfo = actions.updateNativeTokenInfo.use();
  const updateIsSinglePreset = actions.updateIsSinglePreset.use();
  const updatePreCheckTxStatus = actions.updatePreCheckTxStatus.use();
  const updateTokenApproveInfo = actions.updateTokenApproveInfo.use();
  const updateTxAdvancedSettings = actions.updateTxAdvancedSettings.use();
  const updateDecodedTxs = actions.updateDecodedTxs.use();
  const updateExtraFeeInfo = actions.updateExtraFeeInfo.use();
  const updateTronResourceRentalInfo =
    actions.updateTronResourceRentalInfo.use();
  const resetTronResourceRentalInfo = actions.resetTronResourceRentalInfo.use();
  const updatePayWithTokenInfo = actions.updatePayWithTokenInfo.use();
  const resetPayWithTokenInfo = actions.resetPayWithTokenInfo.use();
  const updateTokenTransferAmount = actions.updateTokenTransferAmount.use();
  const updateMegafuelEligible = actions.updateMegafuelEligible.use();
  const resetMegafuelEligible = actions.resetMegafuelEligible.use();
  const updateEffectiveFeePayer = actions.updateEffectiveFeePayer.use();
  const resetEffectiveFeePayer = actions.resetEffectiveFeePayer.use();
  const updateGasAccountUiState = actions.updateGasAccountUiState.use();
  const resetGasAccountUiState = actions.resetGasAccountUiState.use();
  const updateGasAccountTemporarilyDisabled =
    actions.updateGasAccountTemporarilyDisabled.use();
  const resetGasAccountTemporarilyDisabled =
    actions.resetGasAccountTemporarilyDisabled.use();
  const updateDecodedTxsInit = actions.updateDecodedTxsInit.use();
  const updateTxFeeInfoInit = actions.updateTxFeeInfoInit.use();
  const resetTxFeeState = actions.resetTxFeeState.use();
  const updateCustomRpcStatus = actions.updateCustomRpcStatus.use();
  const clearCustomRpcStatus = actions.clearCustomRpcStatus.use();
  return useRef({
    updateUnsignedTxs,
    updateSendSelectedFee,
    updateCustomFee,
    clearCustomFee,
    updateSendSelectedFeeInfo,
    clearSendSelectedFeeInfo,
    updateSendFeeStatus,
    resetSendFeeStatus,
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
    updateSendTxStatus,
    updateNativeTokenInfo,
    updateIsSinglePreset,
    updatePreCheckTxStatus,
    updateTokenApproveInfo,
    updateTxAdvancedSettings,
    updateDecodedTxs,
    updateExtraFeeInfo,
    updateTronResourceRentalInfo,
    resetTronResourceRentalInfo,
    updatePayWithTokenInfo,
    resetPayWithTokenInfo,
    updateTokenTransferAmount,
    updateMegafuelEligible,
    resetMegafuelEligible,
    updateEffectiveFeePayer,
    resetEffectiveFeePayer,
    updateGasAccountUiState,
    resetGasAccountUiState,
    updateGasAccountTemporarilyDisabled,
    resetGasAccountTemporarilyDisabled,
    updateDecodedTxsInit,
    updateTxFeeInfoInit,
    resetTxFeeState,
    updateCustomRpcStatus,
    clearCustomRpcStatus,
  });
}
