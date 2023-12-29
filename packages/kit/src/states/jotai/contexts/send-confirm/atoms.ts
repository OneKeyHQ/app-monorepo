import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { EGasType, ICustomGas } from '@onekeyhq/shared/types/gas';

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

export const { atom: sendSelectedGasAtom, use: useSendSelectedGasAtom } =
  contextAtom<EGasType.Custom | number>(1);

export const { atom: customGasAtom, use: useCustomGasAtom } =
  contextAtom<ICustomGas | null>(null);
