import type { IEarnText } from '@onekeyhq/shared/types/staking';

export function withNetApySignColor(netApy?: IEarnText): IEarnText | undefined {
  if (!netApy) {
    return undefined;
  }
  const numeric = Number.parseFloat(netApy.text.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric === 0) {
    return netApy;
  }
  return {
    ...netApy,
    color: numeric > 0 ? '$textSuccess' : '$textCritical',
  };
}

// The figure among an account's own loans (My portfolio's loan card): only a
// loss is colored. Green there read as borrowing to earn more, so a gain
// stays in the text's color, as on the DeFi home's Loans list
export function withNetApyLossColor(netApy?: IEarnText): IEarnText | undefined {
  const colored = withNetApySignColor(netApy);
  return colored?.color === '$textSuccess' ? netApy : colored;
}
