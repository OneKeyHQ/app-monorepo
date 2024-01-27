import { useRef } from 'react';

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
  nativeTokenTransferAmount,
  sendAlertStatus,
  sendFeeStatus,
  sendSelectedFeeAtom,
  sendSelectedFeeInfoAtom,
} from './atoms';

class ContextJotaiActionsSendConfirm extends ContextJotaiActionsBase {
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
      set(sendFeeStatus(), payload);
    },
  );

  updateNativeTokenTransferAmount = contextAtomMethod(
    (get, set, amount: string) => {
      set(nativeTokenTransferAmount(), amount);
    },
  );

  updateSendConfirmStatus = contextAtomMethod(
    (
      get,
      set,
      status: {
        isInsufficientNativeBalance?: boolean;
      },
    ) => {
      set(sendAlertStatus(), status);
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsSendConfirm()', Date.now());
  return new ContextJotaiActionsSendConfirm();
});

export function useSendConfirmActions() {
  const actions = createActions();
  const updateSendSelectedFee = actions.updateSendSelectedFee.use();
  const updateCustomFee = actions.updateCustomFee.use();
  const updateSendSelectedFeeInfo = actions.updateSendSelectedFeeInfo.use();
  const updateSendFeeStatus = actions.updateSendFeeStatus.use();
  const updateNativeTokenTransferAmount =
    actions.updateNativeTokenTransferAmount.use();
  const updateSendAlertStatus = actions.updateSendConfirmStatus.use();

  return useRef({
    updateSendSelectedFee,
    updateCustomFee,
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateNativeTokenTransferAmount,
    updateSendAlertStatus,
  });
}
