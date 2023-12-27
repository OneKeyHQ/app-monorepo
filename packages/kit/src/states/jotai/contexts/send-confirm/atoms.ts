import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ICustomGas } from '@onekeyhq/shared/types/gas';
import { EGasType } from '@onekeyhq/shared/types/gas';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextSendConfirm,
  withProvider: withSendConfirmProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextSendConfirm,
  withSendConfirmProvider,
  contextAtomMethod,
};

export const { atom: unsignedTxsAtom, use: useUnsignedTxsAtom } = contextAtom<
  IUnsignedTxPro[]
>([]);

export const { atom: sendGasTypeAtom, use: useSendGasTypeAtom } =
  contextAtom<EGasType>(EGasType.Standard);

export const { atom: customGasAtom, use: useCustomGasAtom } =
  contextAtom<ICustomGas | null>(null);

export const {
  atom: selectedPresetGasIndexAtom,
  use: useSelectedPresetGasIndexAtom,
} = contextAtom<number>(1);
