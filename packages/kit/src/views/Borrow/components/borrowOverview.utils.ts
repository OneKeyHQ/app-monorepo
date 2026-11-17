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
