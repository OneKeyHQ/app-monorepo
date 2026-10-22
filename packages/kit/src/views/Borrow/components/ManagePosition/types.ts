import type { ReactElement, ReactNode } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import type {
  EApproveType,
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

export interface IBorrowApproveTarget {
  accountId: string;
  networkId: string;
  spenderAddress: string;
  token?: IToken;
}

export type IManagePositionApproveTarget = IBorrowApproveTarget & {
  token: IToken;
};

export interface IBorrowDelegationApproveTarget {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  allowance: string;
}

export interface IManagePositionApproval {
  approveType?: EApproveType;
  approving: boolean;
  isFormInteractionLocked: boolean;
  approvalProgressStarted: boolean;
  loadingAllowance: boolean;
  shouldApprove: boolean;
  ensureReadyToSubmit: () => Promise<boolean>;
  onApprove: () => Promise<void>;
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
  // An amount to start on, entered once as if typed (the Earn Router page
  // after a withdrawal: what it took out)
  initialAmount?: string;
  // The caller's own token picker (Pay with) in place of the reserve picker
  onTokenSelectorPress?: () => void;
  // The amount box's label, in place of the action's name
  inputTitle?: string;
  // Off where the caller pays with another token itself (Pay with): no
  // "Not enough X? Swap" row
  showSwapOrBridge?: boolean;
  // The caller's own protocol selector (the Earn deposit modal's offers),
  // under the amount box
  offerSwitch?: ReactNode;
  // What is typed, so a caller that starts the form over can carry it
  onAmountChange?: (amount: string) => void;
  // A new key presses the button once by itself, as soon as the amount has
  // passed its checks: the swap that paid for this supply asked for it
  autoSubmitKey?: number;
  // Told when that press happens, so a remounted form doesn't press again
  onAutoSubmit?: () => void;
  repayAllBalance?: string;
  debtBalance?: string;
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price?: string;
  tokenInfo?: IEarnTokenInfo;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  borrowDelegationApproveTarget?: IBorrowDelegationApproveTarget;
  currentAllowance?: string;

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
  // Resolves false when the flow never started (the user rejected the risk
  // disclaimer, say), so the form can keep what the user typed.
  onConfirm?: (params: IManagePositionConfirmParams) => Promise<boolean | void>;
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
  debtBalance?: string;
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
  transactionConfirmationLoading: boolean;
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
  approval: IManagePositionApproval;
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
  autoSubmitKey?: number;
  onAutoSubmit?: () => void;
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

export interface ITokenSelectorTriggerProps extends Pick<
  IXStackProps,
  'tabIndex' | 'onKeyDown' | 'focusVisibleStyle'
> {
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
