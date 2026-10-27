import type { ILoanLtvBar } from './loanRouter.utils';

// The Health Factor tiers: 2 and up, 1.25 to 2, under 1.25
export type ILoanLtvTone = 'success' | 'caution' | 'critical';

export type ILoanLtvBarProps = {
  // None while the market's figures load: the track waits, without a thumb
  bar?: ILoanLtvBar;
  // The health factor the loan leaves, in its colors
  tone: ILoanLtvTone;
  disabled?: boolean;
  // A fraction of the collateral's value; within what is borrowed already
  // and Max LTV
  onChange: (ltv: number) => void;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
  valueText?: string;
  // "Max 76.43%", under the wall
  capLabel?: string;
  // The red part's hint
  liquidationLabel?: string;
  testID?: string;
};
