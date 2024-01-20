import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { EFeeType } from '@onekeyhq/shared/types/gas';

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

export const { atom: sendSelectedFeeAtom, use: useSendSelectedFeeAtom } =
  contextAtom<{
    feeType: EFeeType;
    presetIndex: number;
  }>({
    feeType: EFeeType.Standard,
    presetIndex: 1,
  });

export const { atom: customFeeAtom, use: useCustomFeeAtom } =
  contextAtom<IFeeInfoUnit | null>(null);
