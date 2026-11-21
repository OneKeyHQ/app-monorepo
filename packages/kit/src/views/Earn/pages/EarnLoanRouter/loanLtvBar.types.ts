import type { ILoanLtvBar } from './loanRouter.utils';

// The Health Factor tiers, the Borrow page's: 1.5 and up, 1.1 to 1.5, under
// 1.1
export type ILoanLtvTone = 'success' | 'caution' | 'critical';

export type ILoanLtvBarProps = {
  // None while the market's figures load: a plain track, the Max line's room
  // kept
  bar?: ILoanLtvBar;
  // The market doesn't lend here: what is borrowed there already, if
  // anything, without a thumb, a limit or the red part, and no Max line
  isInert?: boolean;
  // The health factor the loan leaves, in its colors
  tone: ILoanLtvTone;
  disabled?: boolean;
  // A fraction of the collateral's value; within what is borrowed already
  // and Max LTV, in whole percents. isFinal: the press is over (let go, or
  // a key's step), so the loan it gives becomes the plan
  onChange: (ltv: number, isFinal: boolean) => void;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
  valueText?: string;
  // "Max 76.43%", under the wall
  capLabel?: string;
  // The red part's hint
  liquidationLabel?: string;
  testID?: string;
};
