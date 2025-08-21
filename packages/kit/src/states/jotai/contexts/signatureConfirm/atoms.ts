import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import {
  EFeeType,
  ESendFeeStatus,
  ETronResourceRentalPayType,
} from '@onekeyhq/shared/types/fee';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextSignatureConfirm,
  withProvider: withSignatureConfirmProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextSignatureConfirm,
  withSignatureConfirmProvider,
  contextAtomMethod,
};

export const { atom: unsignedTxsAtom, use: useUnsignedTxsAtom } = contextAtom<
  IUnsignedTxPro[]
>([]);

export const { atom: decodedTxsAtom, use: useDecodedTxsAtom } = contextAtom<{
  decodedTxs: IDecodedTx[];
  isBuildingDecodedTxs: boolean;
}>({
  decodedTxs: [],
  isBuildingDecodedTxs: false,
});

export const { atom: sendSelectedFeeAtom, use: useSendSelectedFeeAtom } =
  contextAtom<{
    feeType: EFeeType;
    presetIndex: number;
    source?: 'dapp' | 'wallet';
  }>({
    feeType: EFeeType.Standard,
    presetIndex: 0,
    source: 'wallet',
  });

export const { atom: customFeeAtom, use: useCustomFeeAtom } = contextAtom<
  IFeeInfoUnit | undefined
>(undefined);

export const {
  atom: sendSelectedFeeInfoAtom,
  use: useSendSelectedFeeInfoAtom,
} = contextAtom<
  | {
      feeInfos: ISendSelectedFeeInfo[];
      total: string;
      totalNative: string;
      totalFiat: string;
      totalNativeForDisplay: string;
      totalFiatForDisplay: string;
    }
  | undefined
>(undefined);

export const { atom: sendFeeStatusAtom, use: useSendFeeStatusAtom } =
  contextAtom<{
    status: ESendFeeStatus;
    errMessage?: string;
  }>({
    status: ESendFeeStatus.Idle,
    errMessage: '',
  });

export const {
  atom: nativeTokenTransferAmountAtom,
  use: useNativeTokenTransferAmountAtom,
} = contextAtom<string>('0');

export const {
  atom: nativeTokenTransferAmountToUpdateAtom,
  use: useNativeTokenTransferAmountToUpdateAtom,
} = contextAtom<{
  isMaxSend: boolean;
  amountToUpdate: string;
}>({
  isMaxSend: false,
  amountToUpdate: '0',
});

export const { atom: nativeTokenInfoAtom, use: useNativeTokenInfoAtom } =
  contextAtom<{
    isLoading: boolean;
    balance: string;
    logoURI: string;
  }>({
    isLoading: false,
    balance: '0',
    logoURI: '',
  });

export const { atom: sendTxStatusAtom, use: useSendTxStatusAtom } =
  contextAtom<{
    isInsufficientNativeBalance?: boolean;
    isInsufficientTokenBalance?: boolean;
    isSubmitting?: boolean;
    isSendNativeTokenOnly?: boolean;
    fillUpNativeBalance?: string;
    fillUpTokenBalance?: string;
    isBaseOnEstimateMaxFee?: boolean;
    maxFeeNative?: string;
  }>({
    isInsufficientNativeBalance: false,
    isInsufficientTokenBalance: false,
    fillUpTokenBalance: '0',
    isBaseOnEstimateMaxFee: false,
    maxFeeNative: '0',
    isSubmitting: false,
    isSendNativeTokenOnly: false,
    fillUpNativeBalance: '0',
  });

export const { atom: preCheckTxStatusAtom, use: usePreCheckTxStatusAtom } =
  contextAtom<{
    errorMessage?: string;
  }>({
    errorMessage: '',
  });

export const { atom: isSinglePresetAtom, use: useIsSinglePresetAtom } =
  contextAtom<boolean>(true);

export const { atom: tokenApproveInfoAtom, use: useTokenApproveInfoAtom } =
  contextAtom<{
    originalAllowance: string;
    originalIsUnlimited: boolean;
  }>({
    originalAllowance: '',
    originalIsUnlimited: false,
  });

export const { atom: txAdvancedSettingsAtom, use: useTxAdvancedSettingsAtom } =
  contextAtom<{
    nonce: string;
    dataChanged: boolean;
  }>({
    nonce: '',
    dataChanged: false,
  });

export const { atom: extraFeeInfoAtom, use: useExtraFeeInfoAtom } =
  contextAtom<{
    feeNative: string;
  }>({
    feeNative: '0',
  });

export const {
  atom: tronResourceRentalInfoAtom,
  use: useTronResourceRentalInfoAtom,
} = contextAtom<ITronResourceRentalInfo>({
  payType: ETronResourceRentalPayType.Native,
  isResourceRentalNeeded: false,
  isResourceRentalEnabled: false,
  isSwapTrxEnabled: false,
  resourcePrice: {
    price: 0,
    minutes: 0,
  },
  isResourceRedeemed: false,
  isResourceClaimed: false,
});

export const { atom: megafuelEligibleAtom, use: useMegafuelEligibleAtom } =
  contextAtom<{
    sponsorable: boolean;
    sponsorName: string;
  }>({
    sponsorable: false,
    sponsorName: '',
  });

export const { atom: payWithTokenInfoAtom, use: usePayWithTokenInfoAtom } =
  contextAtom<{
    enabled: boolean;
    address: string;
    balance: string;
    logoURI: string;
    isLoading: boolean;
    symbol: string;
  }>({
    enabled: false,
    address: '',
    balance: '0',
    logoURI: '',
    isLoading: false,
    symbol: '',
  });

export const {
  atom: tokenTransferAmountAtom,
  use: useTokenTransferAmountAtom,
} = contextAtom<string>('0');
