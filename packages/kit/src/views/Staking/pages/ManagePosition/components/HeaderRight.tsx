import { useEffect } from 'react';

import { Button, IconButton, XStack } from '@onekeyhq/components';
import { useStakingPendingTxs } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { RefreshCooldownButton } from '@onekeyhq/kit/src/views/Staking/components/RefreshCooldownButton';
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
  // Pendle quote lifecycle
  isPendleProvider?: boolean;
  onRefreshQuote?: () => void;
  refreshLoading?: boolean;
  refreshCooldownTrigger?: number;
  onOpenSlippage?: () => void;
};

export const HeaderRight = ({
  accountId,
  networkId,
  stakeTag,
  historyAction,
  onHistory,
  onRefresh,
  onRefreshPending,
  isPendleProvider,
  onRefreshQuote,
  refreshLoading,
  refreshCooldownTrigger,
  onOpenSlippage,
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
  const showPendleControls = isPendleProvider;
  const hasContent = pendingCount || showHistory || showPendleControls;

  if (!hasContent) {
    return null;
  }

  // Figma order: Slippage → History → Refresh
  return (
    <XStack ai="center" gap="$3.5">
      {showPendleControls ? (
        <IconButton
          icon="SliderHorOutline"
          variant="tertiary"
          size="small"
          onPress={onOpenSlippage}
        />
      ) : null}
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
      {showPendleControls && onRefreshQuote ? (
        <RefreshCooldownButton
          onPress={onRefreshQuote}
          loading={refreshLoading}
          triggerCooldown={refreshCooldownTrigger}
        />
      ) : null}
    </XStack>
  );
};
