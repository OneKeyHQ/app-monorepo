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
  showSlippageControl?: boolean;
  showQuoteRefresh?: boolean;
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
  showSlippageControl,
  showQuoteRefresh,
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
  const hasContent =
    pendingCount || showHistory || showSlippageControl || showQuoteRefresh;

  if (!hasContent) {
    return null;
  }

  // Figma order: Slippage → History → Refresh
  return (
    <XStack ai="center" gap="$3.5">
      {showSlippageControl ? (
        <IconButton
          testID="staking-has-content-icon-btn"
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
          testID="staking-has-content-btn"
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
      {showQuoteRefresh && onRefreshQuote ? (
        <RefreshCooldownButton
          onPress={onRefreshQuote}
          loading={refreshLoading}
          triggerCooldown={refreshCooldownTrigger}
        />
      ) : null}
    </XStack>
  );
};
