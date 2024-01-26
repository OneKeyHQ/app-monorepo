import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/gas';

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

export const { atom: customFeeAtom, use: useCustomFeeAtom } = contextAtom<
  IFeeInfoUnit | undefined
>(undefined);

export const {
  atom: sendSelectedFeeInfoAtom,
  use: useSendSelectedFeeInfoAtom,
} = contextAtom<
  | {
      totalNative: string;
      feeInfo: IFeeInfoUnit;
    }
  | undefined
>(undefined);

export const { atom: sendFeeStatus, use: useSendFeeStatus } = contextAtom<{
  status: ESendFeeStatus;
  errMessage?: string;
}>({
  status: ESendFeeStatus.Idle,
  errMessage: '',
});

export const {
  atom: nativeTokenTransferAmount,
  use: useNativeTokenTransferAmount,
} = contextAtom<string | undefined>('0');

export const { atom: sendAlertStatus, use: useSendAlertStatus } = contextAtom<{
  isInsufficientNativeBalance?: boolean;
}>({
  isInsufficientNativeBalance: false,
});
