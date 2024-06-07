import { useCallback, useEffect } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { Badge, IconButton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

type IStakingActivityIndicatorProps = {
  isPending?: boolean;
  onPress?: () => void;
};

const StakingActivityIndicator = ({
  isPending,
  onPress,
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(
    () =>
      isPending ? (
        <Badge badgeType="info" badgeSize="lg" onPress={onPress}>
          Pending
        </Badge>
      ) : (
        <IconButton
          variant="tertiary"
          size="small"
          icon="ClockTimeHistoryOutline"
          onPress={onPress}
        />
      ),
    [isPending, onPress],
  );
  useEffect(() => {
    appNavigation.setOptions({
      headerRight,
    });
  }, [appNavigation, headerRight, isPending]);
  return null;
};

export const StakingTransactionIndicator = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
  onPress,
}: {
  accountId: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
  onPress?: () => void;
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

  return <StakingActivityIndicator isPending={isPending} onPress={onPress} />;
};
