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

export const { atom: sendSelectedGasAtom, use: useSendSelectedGasAtom } =
  contextAtom<{
    gasType: EGasType;
    presetIndex: number;
  }>({
    gasType: EGasType.Standard,
    presetIndex: 1,
  });

export const { atom: customGasAtom, use: useCustomGasAtom } =
  contextAtom<ICustomGas | null>(null);
