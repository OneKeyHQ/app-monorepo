import { useCallback, useEffect } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { Badge } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

type IStakingActivityIndicatorProps = {
  isPending?: boolean;
};

const StakingActivityIndicator = ({
  isPending,
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(
    () => (
      <Badge badgeType="info" badgeSize="lg">
        Pending
      </Badge>
    ),
    [],
  );
  useEffect(() => {
    appNavigation.setOptions({
      headerRight: isPending ? headerRight : () => null,
    });
  }, [appNavigation, headerRight, isPending]);
  return null;
};

export const StakingTransactionIndicator = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
}: {
  accountId: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
}) => {
  const { result: isPending, run } = usePromiseResult(
    async () => {
      const txs =
        await backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
          accountId,
          networkId,
          stakeTag,
        });
      return txs.length > 0;
    },
    [accountId, networkId, stakeTag],
    { initResult: false },
  );

  const prevIsPending = usePrevious(isPending);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void run();
    }
  }, [isFocused, run]);

  useEffect(() => {
    if (!isPending) return;
    const timer = setInterval(async () => {
      await backgroundApiProxy.serviceHistory.refreshAccountHistory({
        accountId,
        networkId,
      });
      await run();
    }, 15 * 1000);
    return () => clearInterval(timer);
  }, [isPending, accountId, networkId, run]);

  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefresh?.();
    }
  }, [prevIsPending, isPending, onRefresh]);

  return <StakingActivityIndicator isPending={isPending} />;
};
