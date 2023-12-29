import { useRef } from 'react';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { EGasType, ICustomGas } from '@onekeyhq/shared/types/gas';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  customGasAtom,
  sendSelectedGasAtom,
  unsignedTxsAtom,
} from './atoms';

class ContextJotaiActionsSendConfirm extends ContextJotaiActionsBase {
  updateUnsignedTxs = contextAtomMethod(
    (get, set, unsignedTxs: IUnsignedTxPro[]) => {
      set(unsignedTxsAtom(), unsignedTxs);
    },
  );

  updateSendSelectedGas = contextAtomMethod(
    (get, set, sendSelectedGas: EGasType.Custom | number) => {
      set(sendSelectedGasAtom(), sendSelectedGas);
    },
  );

  updateCustomGas = contextAtomMethod((get, set, customGas: ICustomGas) => {
    set(customGasAtom(), customGas);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsSendConfirm()', Date.now());
  return new ContextJotaiActionsSendConfirm();
});

export function useSendConfirmActions() {
  const actions = createActions();
  const updateUnsignedTxs = actions.updateUnsignedTxs.use();
  const updateSendSelectedGas = actions.updateSendSelectedGas.use();
  const updateCustomGas = actions.updateCustomGas.use();

  return useRef({
    updateUnsignedTxs,
    updateSendSelectedGas,
    updateCustomGas,
  });
}
