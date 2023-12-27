import { useRef } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { EGasType, ICustomGas } from '@onekeyhq/shared/types/gas';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  customGasAtom,
  selectedPresetGasIndexAtom,
  sendGasTypeAtom,
  unsignedTxsAtom,
} from './atoms';

class ContextJotaiActionsSendConfirm extends ContextJotaiActionsBase {
  updateUnsignedTxs = contextAtomMethod(
    (get, set, unsignedTxs: IUnsignedTxPro[]) => {
      set(unsignedTxsAtom(), unsignedTxs);
    },
  );

  updateSendGasType = contextAtomMethod((get, set, sendGasType: EGasType) => {
    set(sendGasTypeAtom(), sendGasType);
  });

  updateCustomGas = contextAtomMethod((get, set, customGas: ICustomGas) => {
    set(customGasAtom(), customGas);
  });

  updateSelectedPresetGasIndex = contextAtomMethod(
    (get, set, index: number) => {
      set(selectedPresetGasIndexAtom(), index);
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
  const updateSendGasType = actions.updateSendGasType.use();
  const updateCustomGas = actions.updateCustomGas.use();
  const updateSelectedPresetGasIndex =
    actions.updateSelectedPresetGasIndex.use();

  return useRef({
    updateUnsignedTxs,
    updateSendGasType,
    updateCustomGas,
    updateSelectedPresetGasIndex,
  });
}
