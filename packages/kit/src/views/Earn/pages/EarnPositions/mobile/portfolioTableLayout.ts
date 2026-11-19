import { createContext, useContext } from 'react';

/**
 * Whether My portfolio is laid out for a wide screen (media.gtMd), the way
 * the wallet DeFi Portfolio switches to its desktop layout: every group is
 * an open card and holdings read as tables. The phone parts read it to pick
 * their shell; the data and the actions stay the same.
 */
export const PortfolioTableLayoutContext = createContext(false);

export function usePortfolioTableLayout() {
  return useContext(PortfolioTableLayoutContext);
}
