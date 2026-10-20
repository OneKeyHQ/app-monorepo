import {
  estimatePrivateSendQuoteCardHeight,
  getMobilePrivateSendAmountTopOffset,
} from './privateSendAmountLayoutUtils';

// Values measured on iPhone 17 Pro with the default tokens: help link 20,
// button/link gap 10, quote card 133, regular balance card 60, body gap 20,
// bottom-info gap 12.
const measured = {
  footerHelpHeight: 20,
  footerActionsGap: 10,
  quoteCardHeight: 133,
  regularBalanceCardHeight: 60,
  bodyGap: 20,
  bottomInfoGap: 12,
};

describe('getMobilePrivateSendAmountTopOffset', () => {
  it('pads by the full height difference between the two bottom stacks', () => {
    expect(getMobilePrivateSendAmountTopOffset(measured)).toBe(71);
  });

  it('drops the link and its gap together when "How it works" is hidden', () => {
    expect(
      getMobilePrivateSendAmountTopOffset({ ...measured, footerHelpHeight: 0 }),
    ).toBe(41);
  });

  it('follows the quote card when its details expand', () => {
    expect(
      getMobilePrivateSendAmountTopOffset({
        ...measured,
        quoteCardHeight: 133 + 28 * 2,
      }),
    ).toBe(127);
  });

  it('ignores the regular balance card when that tab has none', () => {
    expect(
      getMobilePrivateSendAmountTopOffset({
        ...measured,
        quoteCardHeight: 68,
        regularBalanceCardHeight: 0,
      }),
    ).toBe(66);
  });

  it('never returns a negative padding and rounds to whole points', () => {
    expect(
      getMobilePrivateSendAmountTopOffset({
        ...measured,
        quoteCardHeight: 10,
      }),
    ).toBe(0);
    expect(
      getMobilePrivateSendAmountTopOffset({
        ...measured,
        footerHelpHeight: 20.4,
      }),
    ).toBe(71);
  });
});

describe('estimatePrivateSendQuoteCardHeight', () => {
  const base = {
    cardPaddingY: 10,
    summaryRowMinHeight: 48,
    detailRowHeight: 28,
    detailRowCount: 2,
    isDetailsExpanded: false,
    showBalanceRow: true,
    dividerHeight: 1,
    dividerMarginY: 8,
    balanceRowHeight: 48,
  };

  it('matches the measured collapsed card', () => {
    expect(estimatePrivateSendQuoteCardHeight(base)).toBe(133);
  });

  it('adds the detail rows when expanded', () => {
    expect(
      estimatePrivateSendQuoteCardHeight({ ...base, isDetailsExpanded: true }),
    ).toBe(189);
  });

  it('drops the divider and balance row for NFTs or empty balances', () => {
    expect(
      estimatePrivateSendQuoteCardHeight({ ...base, showBalanceRow: false }),
    ).toBe(68);
  });
});
