import { useEffect, useMemo, useRef } from 'react';

import { Button, IconButton, XStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { useStakingPendingTxs } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { RefreshCooldownButton } from '@onekeyhq/kit/src/views/Staking/components/RefreshCooldownButton';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';
import type {
  IEarnHistoryActionIcon,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';

// What the controls show. A modal showing one side has no tab line to hold
// them, so it draws them in its own header from these
export type IHeaderRightViewProps = {
  pendingCount: number;
  historyText?: string;
  showHistory: boolean;
  showPendleControls: boolean;
  hasRefreshQuote: boolean;
  refreshLoading?: boolean;
  refreshCooldownTrigger?: number;
  onHistory: () => void;
  onOpenSlippage: () => void;
  onRefreshQuote: () => void;
  // History by its icon alone, its word on hover, as the Swap page's
  // header keeps its controls (the Earn window)
  historyIconOnly?: boolean;
};

const HEADER_CONTROLS_ENTER = { opacity: 0 } as const;

export function HeaderRightView({
  pendingCount,
  historyText,
  showHistory,
  showPendleControls,
  hasRefreshQuote,
  refreshLoading,
  refreshCooldownTrigger,
  onHistory,
  onOpenSlippage,
  onRefreshQuote,
  historyIconOnly,
}: IHeaderRightViewProps) {
  // Figma order: Slippage → History → Refresh. They come with the form's
  // data, after the frame that holds its place: they fade in, as the
  // figures that come later do
  return (
    <XStack
      ai="center"
      gap="$3.5"
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={HEADER_CONTROLS_ENTER}
    >
      {showPendleControls ? (
        <IconButton
          testID="staking-has-content-icon-btn"
          icon="SliderHorOutline"
          variant="tertiary"
          size="small"
          onPress={onOpenSlippage}
        />
      ) : null}
      {pendingCount ? (
        <PendingIndicator num={pendingCount} onPress={onHistory} />
      ) : null}
      {!pendingCount && showHistory && historyIconOnly ? (
        <IconButton
          testID="staking-has-content-btn"
          icon="ClockTimeHistoryOutline"
          variant="tertiary"
          size="small"
          title={historyText}
          onPress={onHistory}
        />
      ) : null}
      {!pendingCount && showHistory && !historyIconOnly ? (
        <Button
          testID="staking-has-content-btn"
          h="$8"
          mr="unset"
          variant="tertiary"
          icon="ClockTimeHistoryOutline"
          size="small"
          onPress={onHistory}
        >
          {historyText}
        </Button>
      ) : null}
      {showPendleControls && hasRefreshQuote ? (
        <RefreshCooldownButton
          onPress={onRefreshQuote}
          loading={refreshLoading}
          triggerCooldown={refreshCooldownTrigger}
        />
      ) : null}
    </XStack>
  );
}

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
  // Hands the controls to the caller to draw (null: none to show) instead of
  // drawing them here
  onLift?: (view: IHeaderRightViewProps | null) => void;
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
  onLift,
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

  const showHistory = Boolean(historyAction && !historyAction.disabled);
  const showPendleControls = Boolean(isPendleProvider);
  const hasContent = Boolean(pendingCount || showHistory || showPendleControls);
  const historyText = historyAction?.text.text;
  const hasRefreshQuote = Boolean(onRefreshQuote);

  // Handlers that stay the same while calling the latest ones, so handing the
  // controls out doesn't hand them out again on every render
  const handlersRef = useRef({ onHistory, onOpenSlippage, onRefreshQuote });
  useEffect(() => {
    handlersRef.current = { onHistory, onOpenSlippage, onRefreshQuote };
  }, [onHistory, onOpenSlippage, onRefreshQuote]);
  const handlers = useMemo(
    () => ({
      onHistory: () => handlersRef.current.onHistory?.(),
      onOpenSlippage: () => handlersRef.current.onOpenSlippage?.(),
      onRefreshQuote: () => handlersRef.current.onRefreshQuote?.(),
    }),
    [],
  );
  useEffect(() => {
    onLift?.(
      hasContent
        ? {
            pendingCount,
            historyText,
            showHistory,
            showPendleControls,
            hasRefreshQuote,
            refreshLoading,
            refreshCooldownTrigger,
            ...handlers,
          }
        : null,
    );
  }, [
    handlers,
    hasContent,
    hasRefreshQuote,
    historyText,
    onLift,
    pendingCount,
    refreshCooldownTrigger,
    refreshLoading,
    showHistory,
    showPendleControls,
  ]);
  useEffect(() => () => onLift?.(null), [onLift]);

  if (!hasContent || onLift) {
    return null;
  }

  return (
    <HeaderRightView
      pendingCount={pendingCount}
      historyText={historyText}
      showHistory={showHistory}
      showPendleControls={showPendleControls}
      hasRefreshQuote={hasRefreshQuote}
      refreshLoading={refreshLoading}
      refreshCooldownTrigger={refreshCooldownTrigger}
      {...handlers}
    />
  );
};
