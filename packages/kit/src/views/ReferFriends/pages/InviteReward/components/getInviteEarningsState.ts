import { toAmount } from '@onekeyhq/kit/src/views/ReferFriends/utils';

export interface IInviteEarningsInput {
  distributed?: string;
  undistributed?: string;
}

export interface IInviteEarningsState {
  isZero: boolean;
  undistributed: string;
  distributed: string;
  cumulative: string;
}

export function getInviteEarningsState(
  cumulativeRewards?: IInviteEarningsInput | null,
): IInviteEarningsState {
  const undistributed = toAmount(cumulativeRewards?.undistributed);
  const distributed = toAmount(cumulativeRewards?.distributed);
  const cumulative = distributed.plus(undistributed);

  return {
    isZero: undistributed.isZero() && distributed.isZero(),
    // Keep the source precision. Rounding to cents here would turn a sub-cent
    // USD amount into zero before it is converted to the wallet currency.
    undistributed: undistributed.toFixed(),
    distributed: distributed.toFixed(),
    cumulative: cumulative.toFixed(),
  };
}
