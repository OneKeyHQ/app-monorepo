import { useRef } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  EFeeType,
  ESendFeeStatus,
  IFeeInfoUnit,
} from '@onekeyhq/shared/types/fee';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  customFeeAtom,
  nativeTokenInfoAtom,
  nativeTokenTransferAmountAtom,
  nativeTokenTransferAmountToUpdateAtom,
  sendFeeStatusAtom,
  sendSelectedFeeAtom,
  sendSelectedFeeInfoAtom,
  sendTxStatusAtom,
  unsignedTxsAtom,
} from './atoms';

class ContextJotaiActionsSendConfirm extends ContextJotaiActionsBase {
  updateUnsignedTxs = contextAtomMethod(
    (get, set, unsignedTxs: IUnsignedTxPro[]) => {
      set(unsignedTxsAtom(), unsignedTxs);
    },
  );

  updateSendSelectedFee = contextAtomMethod(
    (get, set, sendSelectedFee: { feeType: EFeeType; presetIndex: number }) => {
      set(sendSelectedFeeAtom(), sendSelectedFee);
    },
  );

  updateCustomFee = contextAtomMethod((get, set, customFee: IFeeInfoUnit) => {
    set(customFeeAtom(), customFee);
  });

  updateSendSelectedFeeInfo = contextAtomMethod(
    (
      get,
      set,
      feeInfo: {
        totalNative: string;
        feeInfo: IFeeInfoUnit;
      },
    ) => {
      set(sendSelectedFeeInfoAtom(), feeInfo);
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
      },
    ) => {
      set(sendTxStatusAtom(), status);
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsSendConfirm()', Date.now());
  return new ContextJotaiActionsSendConfirm();
});

export function useSendConfirmActions() {
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
  });
}
