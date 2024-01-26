import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { EFeeType, IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  customFeeAtom,
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
    (get, set, feeInfo: IFeeInfoUnit) => {
      set(sendSelectedFeeInfoAtom(), feeInfo);
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

  return useRef({
    updateSendSelectedFee,
    updateCustomFee,
    updateSendSelectedFeeInfo,
  });
}
