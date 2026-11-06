import { EarnProtocol } from './EarnProtocol';

import type { IEarnDetailsPortfolioPresentation } from './EarnProtocol';

export class EverstakeEarnProtocol extends EarnProtocol {
  override getDetailsPortfolioPresentation({
    symbol,
  }: {
    symbol: string;
  }): IEarnDetailsPortfolioPresentation {
    const normalizedSymbol = symbol.toLowerCase();
    return {
      activePositions: 'standard',
      pendingActivationTooltip:
        normalizedSymbol === 'eth' ? 'everstake-eth' : 'standard',
      claimableTooltip:
        normalizedSymbol === 'atom' ? 'claim-together' : 'standard',
      claimableLabel: normalizedSymbol === 'pol' ? 'withdrawn' : 'standard',
    };
  }
  override getClaimNavigation({
    symbol,
  }: {
    symbol: string;
  }): 'amount-modal' | 'standard' {
    return symbol.toLowerCase() === 'apt' ? 'amount-modal' : 'standard';
  }
}
