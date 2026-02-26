import { useEffect } from 'react';

import { Button, IconButton, SizableText, XStack } from '@onekeyhq/components';
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
  // Pendle quote lifecycle
  isPendleProvider?: boolean;
  remainingSeconds?: number;
  isQuoteExpired?: boolean;
  onRefreshQuote?: () => void;
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
  remainingSeconds,
  isQuoteExpired,
  onRefreshQuote,
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

  return (
    <XStack ai="center" gap="$2">
      {showPendleControls ? (
        <>
          <IconButton
            icon="SliderHorOutline"
            variant="tertiary"
            size="small"
            onPress={onOpenSlippage}
          />
          {typeof remainingSeconds === 'number' && remainingSeconds > 0 ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              minWidth="$6"
              textAlign="center"
            >
              {remainingSeconds}s
            </SizableText>
          ) : null}
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            disabled={!isQuoteExpired}
            onPress={onRefreshQuote}
          />
        </>
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
    </XStack>
  );
};
