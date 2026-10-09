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
    undistributed: undistributed.toFixed(2),
    distributed: distributed.toFixed(2),
    cumulative: cumulative.toFixed(2),
  };
}
