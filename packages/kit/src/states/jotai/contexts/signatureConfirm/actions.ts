import { useRef } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  EFeeType,
  ESendFeeStatus,
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  customFeeAtom,
  decodedTxsAtom,
  extraFeeInfoAtom,
  isSinglePresetAtom,
  nativeTokenInfoAtom,
  nativeTokenTransferAmountAtom,
  nativeTokenTransferAmountToUpdateAtom,
  preCheckTxStatusAtom,
  sendFeeStatusAtom,
  sendSelectedFeeAtom,
  sendSelectedFeeInfoAtom,
  sendTxStatusAtom,
  tokenApproveInfoAtom,
  txAdvancedSettingsAtom,
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
      sendSelectedFee: { feeType?: EFeeType; presetIndex?: number },
    ) => {
      set(sendSelectedFeeAtom(), {
        ...get(sendSelectedFeeAtom()),
        ...sendSelectedFee,
      });
    },
  );

  updateCustomFee = contextAtomMethod((get, set, customFee: IFeeInfoUnit) => {
    set(customFeeAtom(), customFee);
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
      },
    ) => {
      set(sendSelectedFeeInfoAtom(), payload);
    },
  );

  updateSendFeeStatus = contextAtomMethod(
    (
      get,
      set,
      payload: {
        status: ESendFeeStatus;
        errMessage?: string;
      },
    ) => {
      set(sendFeeStatusAtom(), {
        ...get(sendFeeStatusAtom()),
        ...payload,
      });
    },
  );

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
        isSubmitting?: boolean;
        isSendNativeTokenOnly?: boolean;
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
  const updateSendSelectedFeeInfo = actions.updateSendSelectedFeeInfo.use();
  const updateSendFeeStatus = actions.updateSendFeeStatus.use();
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
  return useRef({
    updateUnsignedTxs,
    updateSendSelectedFee,
    updateCustomFee,
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
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
  });
}
