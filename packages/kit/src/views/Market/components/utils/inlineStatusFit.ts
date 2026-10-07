/**
 * The inline market-status row grows with its translation: "Market closed",
 * the quote timestamp and the next-open countdown fit side by side in English
 * but not in every locale, and the row sits beside the trade panel with no
 * room to wrap. The countdown is the segment that gets dropped — the status
 * and the quote's age are the ones a reader needs.
 */
export function shouldShowOptionalSegment({
  availableWidth,
  contentWidth,
  reservedWidth = 0,
}: {
  /** The row's own measured width; 0 until the first layout pass. */
  availableWidth: number;
  /** Width of the measured stack, optional segment included. */
  contentWidth: number;
  /**
   * Row width the measured stack does not cover — the leading status icon and
   * the gap before it. Without it a chip that overflows by less than the icon
   * still reads as fitting.
   */
  reservedWidth?: number;
}): boolean {
  // Before either measurement lands, render the segment: measuring it is what
  // tells us whether it fits, and a wide viewport keeps it anyway.
  if (availableWidth <= 0 || contentWidth <= 0) {
    return true;
  }
  return contentWidth + reservedWidth <= availableWidth;
}
