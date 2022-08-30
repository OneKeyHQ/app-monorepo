import { useAppSelector } from '../../../hooks';

export function useKelePoolStakingState(
  networkId?: string,
  accountId?: string,
) {
  return useAppSelector(
    (s) => s.staking.keleETH2StakingState?.[accountId ?? '']?.[networkId ?? ''],
  );
}

export function useAccountStakingActivity(
  networkId: string,
  accountId: string,
) {
  return useAppSelector(
    (s) => s.staking.stakingActivities?.[accountId]?.[networkId],
  );
}
