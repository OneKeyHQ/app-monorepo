export interface ISwipeableDayGridProps {
  calendarIndex: number;
  fullWidth?: boolean;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  // Native pager only: lower bound for the absolute offsetDate dispatched on
  // swipe commits (see computeCommitOffsetDate in swipeUtils.ts).
  minDate?: Date;
}
