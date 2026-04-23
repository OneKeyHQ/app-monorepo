import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IFeeInfoUnit,
  IGasAccountQuote,
  IGasPayer,
  ISendSelectedFeeInfo,
  ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import {
  EFeeType,
  ESendFeeStatus,
  ETronResourceRentalPayType,
} from '@onekeyhq/shared/types/fee';
import type { IToken } from '@onekeyhq/shared/types/token';
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

export const { atom: unsignedTxQueueAtom, use: useUnsignedTxQueueAtom } =
  contextAtom<IUnsignedTxPro[]>([]);

export const { atom: decodedTxsAtom, use: useDecodedTxsAtom } = contextAtom<{
  decodedTxs: IDecodedTx[];
  isBuildingDecodedTxs: boolean;
}>({
  decodedTxs: [],
  isBuildingDecodedTxs: false,
});

export const defaultSendSelectedFee = {
  feeType: EFeeType.Standard,
  presetIndex: 0,
  source: 'wallet' as const,
};

export const { atom: sendSelectedFeeAtom, use: useSendSelectedFeeAtom } =
  contextAtom<{
    feeType: EFeeType;
    presetIndex: number;
    source?: 'dapp' | 'wallet';
  }>({ ...defaultSendSelectedFee });

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
      originalTotalNative?: string;
      originalTotalFiat?: string;
    }
  | undefined
>(undefined);

export const defaultSendFeeStatus = {
  status: ESendFeeStatus.Idle,
  errMessage: '',
  discountPercent: 0,
};

export const { atom: sendFeeStatusAtom, use: useSendFeeStatusAtom } =
  contextAtom<{
    status: ESendFeeStatus;
    errMessage?: string;
    discountPercent?: number;
  }>({ ...defaultSendFeeStatus });

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
    info: IToken | undefined;
  }>({
    isLoading: false,
    balance: '0',
    logoURI: '',
    info: undefined,
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

export const defaultTronResourceRentalInfo: ITronResourceRentalInfo = {
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
};

export const {
  atom: tronResourceRentalInfoAtom,
  use: useTronResourceRentalInfoAtom,
} = contextAtom<ITronResourceRentalInfo>({ ...defaultTronResourceRentalInfo });

export const defaultMegafuelEligible = {
  sponsorable: false,
  sponsorName: '',
};

export const { atom: megafuelEligibleAtom, use: useMegafuelEligibleAtom } =
  contextAtom<{
    sponsorable: boolean;
    sponsorName: string;
  }>({ ...defaultMegafuelEligible });

export const defaultEffectiveFeePayer = 'user' as IGasPayer;

// `effectiveFeePayerAtom` is the authoritative "who pays the fee" signal the
// UI renders from (sponsor badges, free copy, fee hiding). It mirrors the
// server's `payer` field with two narrow overrides to `'user'`:
//   - when a custom RPC is active (all sponsors disabled), and
//   - when the server indicates `'gasAccount'` while gas account is
//     temporarily disabled after a fallback (the gas-account path only;
//     a concurrent `'megafuel'` payer still surfaces).
//
// This is intentionally separate from `gasAccountUiState.selectedPayer` below:
//   - `effectiveFeePayer` drives *display* (can be `'megafuel'` even when gas
//     account quote exists — megafuel wins UI-wise).
//   - `selectedPayer` drives *submit wiring* (whether to attach `quoteId` /
//     `idempotencyKey` to the broadcast request).
// Keep them aligned in TxFeeInfo's estimate handler.
export const { atom: effectiveFeePayerAtom, use: useEffectiveFeePayerAtom } =
  contextAtom<IGasPayer>(defaultEffectiveFeePayer);

export const defaultGasAccountUiState = {
  payer: undefined as IGasPayer | undefined,
  gasAccountEligible: false,
  gasAccountQuote: undefined as IGasAccountQuote | undefined,
  selectedPayer: 'user' as const,
  lockedUserNonce: undefined as number | undefined,
  idempotencyKey: '',
};

export const { atom: gasAccountUiStateAtom, use: useGasAccountUiStateAtom } =
  contextAtom<{
    payer?: IGasPayer;
    gasAccountEligible: boolean;
    gasAccountQuote?: IGasAccountQuote;
    selectedPayer: 'user' | 'gasAccount';
    lockedUserNonce?: number;
    idempotencyKey: string;
  }>({ ...defaultGasAccountUiState });

export const {
  atom: gasAccountTemporarilyDisabledAtom,
  use: useGasAccountTemporarilyDisabledAtom,
} = contextAtom<boolean>(false);

export const defaultPayWithTokenInfo = {
  enabled: false,
  address: '',
  balance: '0',
  logoURI: '',
  isLoading: false,
  symbol: '',
};

export const { atom: payWithTokenInfoAtom, use: usePayWithTokenInfoAtom } =
  contextAtom<{
    enabled: boolean;
    address: string;
    balance: string;
    logoURI: string;
    isLoading: boolean;
    symbol: string;
  }>({ ...defaultPayWithTokenInfo });

export const {
  atom: tokenTransferAmountAtom,
  use: useTokenTransferAmountAtom,
} = contextAtom<string>('0');

export const { atom: decodedTxsInitAtom, use: useDecodedTxsInitAtom } =
  contextAtom<boolean>(false);

export const { atom: txFeeInfoInitAtom, use: useTxFeeInfoInitAtom } =
  contextAtom<boolean>(false);

export const {
  atom: txConfirmParamsInitAtom,
  use: useTxConfirmParamsInitAtom,
} = contextAtom<boolean>(false);

export interface ICustomRpcStatusAtomValue {
  isCustomRpcUnavailable: boolean;
  customRpcUrl: string;
  networkId: string;
  // One-time flag: use OneKey RPC for this transaction only
  useDefaultRpcOnce?: boolean;
}

export const { atom: customRpcStatusAtom, use: useCustomRpcStatusAtom } =
  contextAtom<ICustomRpcStatusAtomValue | null>(null);
