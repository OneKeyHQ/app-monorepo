import {
  shouldShowTopUpFooter,
  splitBalanceShortfallLines,
} from './needActionPresentation';

describe('splitBalanceShortfallLines', () => {
  it('splits the joined balance-and-shortfall message into two lines', () => {
    expect(
      splitBalanceShortfallLines(
        'Wallet balance: 0.000008 cbBTC · 0.000019 cbBTC short',
      ),
    ).toEqual(['Wallet balance: 0.000008 cbBTC', '0.000019 cbBTC short']);
  });

  it('splits locales that lead with the shortfall phrase', () => {
    expect(
      splitBalanceShortfallLines(
        '钱包余额：0.000008 cbBTC · 还差 0.000019 cbBTC',
      ),
    ).toEqual([
      '钱包余额：0.000008 cbBTC',
      '还差 0.000019 cbBTC',
    ]);
  });

  // Losing the shortfall figure would be worse than keeping the mid-dot, so a
  // translation that drops the separator degrades to today's single line.
  it('keeps the whole message when the separator is gone', () => {
    const reworded = 'Wallet balance 0.000008 cbBTC, short 0.000019 cbBTC';

    expect(splitBalanceShortfallLines(reworded)).toEqual([reworded]);
  });

  it('keeps the whole message when a translation adds a second separator', () => {
    const doubled = 'a · b · c';

    expect(splitBalanceShortfallLines(doubled)).toEqual([doubled]);
  });

  // A bare mid-dot with no surrounding spaces belongs to the number, not to the
  // separator.
  it('does not split on a mid-dot that carries no spaces', () => {
    const tight = 'Wallet balance: 0.000008·cbBTC';

    expect(splitBalanceShortfallLines(tight)).toEqual([tight]);
  });
});

describe('shouldShowTopUpFooter', () => {
  const underfunded = {
    canRetryCheck: false,
    funding: false,
    isBusy: false,
    pendingGuardBlocksAction: false,
    hasUnderfundedActiveRepay: true,
    hasGetFundsItems: true,
  };

  it('hands the footer to the remedy while the active repay is underfunded', () => {
    expect(shouldShowTopUpFooter(underfunded)).toBe(true);
  });

  it('keeps the plain footer when nothing is underfunded', () => {
    expect(
      shouldShowTopUpFooter({
        ...underfunded,
        hasUnderfundedActiveRepay: false,
      }),
    ).toBe(false);
  });

  // Without a resolvable funding token there is no swap or receive to offer;
  // the disabled step label alone is the honest footer.
  it('keeps the plain footer when there is no way to get the funds', () => {
    expect(
      shouldShowTopUpFooter({ ...underfunded, hasGetFundsItems: false }),
    ).toBe(false);
  });

  it('keeps the plain footer while a top-up is confirming', () => {
    expect(shouldShowTopUpFooter({ ...underfunded, funding: true })).toBe(false);
  });

  // A retry owns the footer label, and it never broadcasts.
  it('keeps the plain footer when a recheck is the available action', () => {
    expect(shouldShowTopUpFooter({ ...underfunded, canRetryCheck: true })).toBe(
      false,
    );
  });

  it('keeps the plain footer mid-signature', () => {
    expect(shouldShowTopUpFooter({ ...underfunded, isBusy: true })).toBe(false);
    expect(
      shouldShowTopUpFooter({
        ...underfunded,
        pendingGuardBlocksAction: true,
      }),
    ).toBe(false);
  });
});
