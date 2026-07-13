import {
  DEFI_PORTFOLIO_DETAIL_COLUMN_NAME_COLOR,
  DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR,
} from './defiPortfolioDetailStyleUtils';

describe('defiPortfolioDetailStyleUtils', () => {
  it('uses subdued text for secondary DeFi portfolio detail labels', () => {
    expect(DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR).toBe('$textSubdued');
    expect(DEFI_PORTFOLIO_DETAIL_COLUMN_NAME_COLOR).toBe('$textSubdued');
  });
});
