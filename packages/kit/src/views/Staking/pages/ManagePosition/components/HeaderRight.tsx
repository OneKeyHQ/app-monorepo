import { useEffect } from 'react';

import { Button, XStack } from '@onekeyhq/components';
import { useStakingPendingTxs } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';
import type {
  IEarnHistoryActionIcon,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';

type IHeaderRightProps = {
  accountId?: string;
  networkId: string;
  stakeTag?: IStakeTag;
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: (params?: { filterType?: string }) => void;
  onRefresh?: () => void;
  onRefreshPending?: (refreshFn: () => Promise<void>) => void;
};

export const HeaderRight = ({
  accountId,
  networkId,
  stakeTag,
  historyAction,
  onHistory,
  onRefresh,
  onRefreshPending,
}: IHeaderRightProps) => {
  const { pendingCount, refreshPending } = useStakingPendingTxs({
    accountId,
    networkId,
    stakeTag,
    onRefresh,
  });

  useEffect(() => {
    onRefreshPending?.(refreshPending);
  }, [onRefreshPending, refreshPending]);

  const showHistory = historyAction && !historyAction.disabled;
  if (!pendingCount && !showHistory) {
    return null;
  }

  return (
    <XStack ai="center" gap="$3">
      {pendingCount ? (
        <PendingIndicator num={pendingCount} onPress={() => onHistory?.()} />
      ) : null}
      {!pendingCount && showHistory ? (
        <Button
          h="$8"
          mr="unset"
          variant="tertiary"
          icon="ClockTimeHistoryOutline"
          size="small"
          disabled={historyAction?.disabled}
          onPress={() => onHistory?.()}
        >
          {historyAction?.text.text}
        </Button>
      ) : null}
    </XStack>
  );
};
