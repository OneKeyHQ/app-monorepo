import type { ReactElement, ReactNode } from 'react';

import type {
  IBorrowAsset,
  IBorrowTransactionConfirmation,
  ICheckAmountAlert,
  IEarnEstimateFeeResp,
  IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

// ============================================================================
// Action Types
// ============================================================================

export type IBorrowActionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

export type ITokenSelectorMode = 'navigation' | 'popover' | 'disabled';

// ============================================================================
// Confirm Params
// ============================================================================

export interface IManagePositionConfirmParams {
  amount: string;
  withdrawAll?: boolean;
  repayAll?: boolean;
}

// ============================================================================
// Main Component Props
// ============================================================================

export interface IManagePositionProps {
  // Core identifiers
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  action: IBorrowActionType;

  // Token info
  balance: string;
  maxBalance?: string;
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price?: string;
  tokenInfo?: IEarnTokenInfo;

  // UI configuration
  isDisabled?: boolean;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  actionLabel?: string;
  isInModalContext?: boolean;

  // Token selection (for withdraw/repay popover mode)
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (item: IBorrowAsset) => void;

  // Callbacks
  onConfirm?: (params: IManagePositionConfirmParams) => Promise<void>;
}

// ============================================================================
// Context State
// ============================================================================

export interface IManagePositionState {
  // Core identifiers
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;

  // Action configuration
  action: IBorrowActionType;
  actionLabel?: string;

  // Token info
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price: string;
  balance: string;
  maxBalance?: string;
  tokenInfo?: IEarnTokenInfo;
  token?: IToken;

  // Network info
  networkLogoURI?: string;

  // UI state
  amountValue: string;
  submitting: boolean;
  isDisabled: boolean;
  isInModalContext: boolean;

  // Derived values
  maxAmountValue: string;
  currentValue?: string;
  currencySymbol: string;

  // Validation state
  isInsufficientBalance: boolean;
  isAmountInvalid: boolean;

  // Action-specific flags
  isWithdrawAll: boolean;
  isRepayAll: boolean;

  // Token selection
  tokenSelectorMode: ITokenSelectorMode;
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  tokenSelectorTriggerProps: ITokenSelectorTriggerProps;

  // UI configuration
  showApyDetail: boolean;
  beforeFooter?: ReactElement | null;
}

// ============================================================================
// Context Actions
// ============================================================================

export interface IManagePositionActions {
  setAmountValue: (value: string) => void;
  setSubmitting: (value: boolean) => void;
  onChangeAmountValue: (value: string) => void;
  onBlurAmountValue: () => void;
  onMax: () => void;
  onSelectPercentageStage: (percent: number) => void;
  onTokenSelect?: (item: IBorrowAsset) => void;
  handleOpenTokenSelector: () => void;
  onSubmit: () => Promise<void>;
}

// ============================================================================
// Action Result (from useUniversalBorrowAction)
// ============================================================================

export interface IManagePositionActionResult {
  estimateFeeResp?: IEarnEstimateFeeResp;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  checkAmountMessage: string;
  checkAmountAlerts: ICheckAmountAlert[];
  checkAmountLoading: boolean;
  isCheckAmountMessageError: boolean;
  checkAmountResult?: boolean;
  riskOfLiquidationAlert?: boolean;
}

// ============================================================================
// Combined Context
// ============================================================================

export interface IManagePositionContextValue {
  state: IManagePositionState;
  actions: IManagePositionActions;
  actionResult: IManagePositionActionResult;
}

// ============================================================================
// Module Props
// ============================================================================

export interface IActionTabBarProps {
  tabs: Array<{ key: IBorrowActionType; label: string }>;
  activeTab: IBorrowActionType;
  onTabChange: (tab: IBorrowActionType) => void;
  rightContent?: ReactNode;
}

export interface IAmountInputSectionProps {
  title?: string;
}

export interface IInfoDisplaySectionProps {
  showApyDetail?: boolean;
  showSwapOrBridge?: boolean;
}

export interface IActionFooterProps {
  isInModalContext?: boolean;
  beforeFooter?: ReactElement | null;
}

// ============================================================================
// Info Display Sub-component Props
// ============================================================================

export interface IHealthFactorInfoProps {
  data: NonNullable<IBorrowTransactionConfirmation['healthFactor']>;
  liquidationAt?: IBorrowTransactionConfirmation['liquidationAt'];
}

export interface IPositionInfoProps {
  type: 'supply' | 'borrow';
  data: NonNullable<
    | IBorrowTransactionConfirmation['mySupply']
    | IBorrowTransactionConfirmation['myBorrow']
  >;
}

export interface IApyInfoProps {
  action: IBorrowActionType;
  data: NonNullable<IBorrowTransactionConfirmation['apyDetail']>;
}

export interface IFeeInfoProps {
  type: 'refundable' | 'refund';
  data: NonNullable<
    | IBorrowTransactionConfirmation['refundableFee']
    | IBorrowTransactionConfirmation['refundFee']
  >;
}

export interface ISwapOrBridgeInfoProps {
  token: IToken;
  accountId: string;
  networkId: string;
}

// ============================================================================
// Token Selector Props
// ============================================================================

export interface ITokenSelectorTriggerProps {
  selectedTokenImageUri?: string;
  selectedTokenSymbol?: string;
  selectedNetworkImageUri?: string;
  onPress?: () => void;
  disabled?: boolean;
  popover?: {
    title: string;
    content:
      | ReactElement
      | ((props: {
          isOpen?: boolean;
          closePopover: () => void;
        }) => ReactElement);
  };
}
