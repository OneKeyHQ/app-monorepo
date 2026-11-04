import type {
  IGasAccountScenario,
  IGasPayer,
} from '@onekeyhq/shared/types/fee';

export type IGasAccountShortageType =
  | 'unknown'
  | 'none'
  | 'principal'
  | 'extraFee'
  | 'networkFee'
  | 'mixed';

export type IGasAccountEntryPoint =
  | 'txConfirm'
  | 'swapDirect'
  | 'marketSwapDirect';

export type IGasAccountFiatBucket =
  | 'unknown'
  | 'lt_0_01'
  | '0_01_0_1'
  | '0_1_1'
  | '1_5'
  | 'gte_5';

export interface IGasAccountAnalyticsContext {
  entryPoint: IGasAccountEntryPoint;
  network: string;
  scenario: IGasAccountScenario | undefined;
  gasAccountRequested: boolean;
  gasAccountSupported: boolean | null;
  gasAccountEligible: boolean | null;
  selectedPayer: 'user' | 'gasAccount';
  effectiveFeePayer: IGasPayer;
  unavailableReason: string | undefined;
  // Raw backend `gasAccountSkipReason` (open string: member_required,
  // member_pending, member_unavailable, eligibility_* …) when the estimate
  // came back self-paid; absent means no reason was given, not "anonymous".
  gasAccountSkipReason: string | undefined;
  // `gasAccountQuote.identity.ownerType` of the sponsored quote ('member'
  // when bound to a OneKey ID member); undefined without a quote.
  quoteOwnerType: string | undefined;
  nativeBalanceAvailable: boolean;
  selfPayGasSufficient: boolean | null;
  shortageType: IGasAccountShortageType;
  estimatedGasNative: string;
  estimatedGasFiat: string | undefined;
  gasShortfallNative: string | undefined;
  gasShortfallFiat: string | undefined;
  gasShortfallFiatBucket: IGasAccountFiatBucket;
  nativeBalanceFiatBucket: IGasAccountFiatBucket;
  fiatCurrency: string | undefined;
  fiatValueAvailable: boolean;
  quoteId: string | undefined;
  orderId: string | undefined;
}

export type ICexDepositWarningPage = 'address' | 'amount';

export type ICexDepositWarningAction = 'continue' | 'back' | 'close';

export interface ISendCexDepositWarningContext {
  network: string;
  tokenSymbol: string | undefined;
  exchange: string;
  page: ICexDepositWarningPage;
}

export interface ISendCexDepositWarningActionParams extends ISendCexDepositWarningContext {
  action: ICexDepositWarningAction;
}

export type IGasAccountActionType =
  | 'confirmClicked'
  | 'payerChanged'
  | 'submitSucceeded'
  | 'submitFailed'
  | 'exited';

export interface IGasAccountActionParams extends IGasAccountAnalyticsContext {
  action: IGasAccountActionType;
  fromPayer?: IGasPayer;
  toPayer?: IGasPayer;
  changeSource?: 'user' | 'system';
  changeReason?:
    | 'userSelection'
    | 'quoteExpired'
    | 'quoteFailed'
    | 'submitFailed'
    | 'unknown';
  failureStage?: 'precheck' | 'prepare' | 'submit' | 'unknown';
  errorCode?: number;
}
