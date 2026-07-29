export const HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID =
  'home.portfolio.showLpTokensOnly';

function resolveHomePortfolioLpTokenSwitch({
  liveLoading,
  liveValue,
  requestedValue,
}: {
  liveLoading: boolean;
  liveValue: boolean;
  requestedValue: unknown;
}): {
  loading: boolean;
  value: boolean;
} {
  const hasRequestedValue = typeof requestedValue === 'boolean';
  const value = hasRequestedValue ? requestedValue : liveValue;
  return {
    loading:
      liveLoading || (requestedValue === true && requestedValue !== liveValue),
    value,
  };
}

export { resolveHomePortfolioLpTokenSwitch };
