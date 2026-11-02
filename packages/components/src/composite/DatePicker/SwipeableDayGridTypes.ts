export interface ISwipeableDayGridProps {
  calendarIndex: number;
  fullWidth?: boolean;
  // Dual-panel layouts hide adjacent-month days: the other panel shows them.
  hideOutOfMonth?: boolean;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  // Native pager only: lower bound for the absolute offsetDate dispatched on
  // swipe commits (see computeCommitOffsetDate in swipeUtils.ts).
  minDate?: Date;
}
