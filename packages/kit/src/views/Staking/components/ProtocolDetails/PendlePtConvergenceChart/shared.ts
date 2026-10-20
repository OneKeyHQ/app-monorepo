import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import type { IPtChartApyPoint } from './ptChartMath';

export type IPtConvergenceChartData = NonNullable<
  NonNullable<IStakeEarnDetail['rules']>['chart']
>;

export interface IPendlePtConvergenceChartProps {
  chart: IPtConvergenceChartData;
  /** The implied APY history the APY chart above draws, newest last. */
  impliedApyHistory?: IPtChartApyPoint[] | null;
  isHistoryLoading?: boolean;
  /** Server maturity text, e.g. "26 Nov 2026". */
  maturityDate?: string;
}
