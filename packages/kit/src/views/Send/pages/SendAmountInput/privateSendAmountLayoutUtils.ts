// Pure layout math for the mobile private send amount page (OK-63409).
//
// On native phones the regular and private tabs use different skeletons: the
// regular tab keeps the balance card inside the scroll body above a Preview
// footer, while the private tab moves the quote card, the action button and
// the "How it works" link into the footer. Both tabs center the amount in the
// space left above their bottom stack, so the taller private stack used to lift
// the amount by half of the height difference on every toggle. Padding the top
// of the private amount column by the full difference puts the centered amount
// back on the regular position; the extra footer content only consumes the
// empty space below it.

export interface IMobilePrivateSendAmountTopOffsetParams {
  // Measured height of the "How it works" link, 0 when it is not rendered.
  footerHelpHeight: number;
  // Gap between the action button and the "How it works" link.
  footerActionsGap: number;
  // Measured (or estimated) height of the private quote card.
  quoteCardHeight: number;
  // Height of the regular tab's balance card, 0 when that card is hidden.
  regularBalanceCardHeight: number;
  // Regular tab only: gap between the centered amount area and bottom info.
  bodyGap: number;
  // Gap that always precedes the regular balance card inside the bottom
  // info stack (left by the zero-height hex-data HeightTransition container).
  bottomInfoGap: number;
}

export function getMobilePrivateSendAmountTopOffset({
  footerHelpHeight,
  footerActionsGap,
  quoteCardHeight,
  regularBalanceCardHeight,
  bodyGap,
  bottomInfoGap,
}: IMobilePrivateSendAmountTopOffsetParams): number {
  const footerHelpBlockHeight =
    footerHelpHeight > 0 ? footerHelpHeight + footerActionsGap : 0;
  const privateBottomExtra = footerHelpBlockHeight + quoteCardHeight;
  const regularBottomStack = regularBalanceCardHeight + bodyGap + bottomInfoGap;
  return Math.max(0, Math.round(privateBottomExtra - regularBottomStack));
}

export interface IPrivateSendQuoteCardHeightEstimateParams {
  cardPaddingY: number;
  summaryRowMinHeight: number;
  detailRowHeight: number;
  detailRowCount: number;
  isDetailsExpanded: boolean;
  showBalanceRow: boolean;
  dividerHeight: number;
  dividerMarginY: number;
  balanceRowHeight: number;
}

// Mirrors the quote card JSX; used only for the frame before the card reports
// its first onLayout so the amount does not flash at the unpadded position.
export function estimatePrivateSendQuoteCardHeight({
  cardPaddingY,
  summaryRowMinHeight,
  detailRowHeight,
  detailRowCount,
  isDetailsExpanded,
  showBalanceRow,
  dividerHeight,
  dividerMarginY,
  balanceRowHeight,
}: IPrivateSendQuoteCardHeightEstimateParams): number {
  return (
    cardPaddingY * 2 +
    summaryRowMinHeight +
    (isDetailsExpanded ? detailRowHeight * detailRowCount : 0) +
    (showBalanceRow ? dividerHeight + dividerMarginY * 2 + balanceRowHeight : 0)
  );
}
