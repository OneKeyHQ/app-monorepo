import { memo, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useReplaceTx } from '../../hooks/useReplaceTx';

import { SpeedUpAction } from './SpeedUpAction';
import { TxHistoryListItemErrorBoundary } from './TxHistoryListItemErrorBoundary';

type IProps = {
  index: number;
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  showIcon?: boolean;
  tableLayout?: boolean;
  hideValue?: boolean;
  compact?: boolean;
  recomputeLayout?: () => void;
};

// Pending-only sub-tree. Kept in its own component so the hook (and its two
// usePromiseResult-driven backgroundApiProxy calls) only mount for the rare
// pending row instead of every confirmed row in the list. Without this split,
// scrolling a history with 100+ rows triggers 100+ background calls per
// re-render, dominating the main-thread cost during fast scroll.
function PendingTxActions({
  historyTx,
  showIcon,
  compact,
  recomputeLayout,
}: {
  historyTx: IAccountHistoryTx;
  showIcon?: boolean;
  compact?: boolean;
  recomputeLayout?: () => void;
}) {
  const intl = useIntl();
  const {
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    handleReplaceTx,
    handleCheckSpeedUpState,
  } = useReplaceTx({ historyTx });

  useEffect(() => {
    if (canReplaceTx !== undefined || checkSpeedUpStateEnabled !== undefined) {
      recomputeLayout?.();
    }
  }, [canReplaceTx, checkSpeedUpStateEnabled, recomputeLayout]);

  if (!canReplaceTx && !checkSpeedUpStateEnabled) return null;

  const renderCancelActions = () => (
    <XStack gap="$3">
      <SpeedUpAction
        networkId={historyTx.decodedTx.networkId}
        onSpeedUp={() =>
          handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
        }
      />
      {cancelTxEnabled ? (
        <Button
          testID="tx-history-list-view-render-cancel-actions-btn"
          size="small"
          onPress={() =>
            handleReplaceTx({ replaceType: EReplaceTxType.Cancel })
          }
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
      ) : null}
    </XStack>
  );

  const renderSpeedUpCancelAction = () =>
    speedUpCancelEnabled ? (
      <Button
        testID="tx-history-list-view-render-speed-up-cancel-action-btn"
        size="small"
        variant="primary"
        onPress={() => handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })}
      >
        {intl.formatMessage({ id: ETranslations.speed_up_cancellation })}
      </Button>
    ) : null;

  const renderCheckSpeedUpState = () => (
    <Button
      testID="tx-history-list-view-render-check-speed-up-state-btn"
      size="small"
      variant="primary"
      onPress={() => handleCheckSpeedUpState()}
    >
      {intl.formatMessage({
        id: ETranslations.tx_accelerate_order_inquiry_label,
      })}
    </Button>
  );

  const renderReplaceButtons = () => {
    if (!canReplaceTx) return null;
    return canCancelTx ? renderCancelActions() : renderSpeedUpCancelAction();
  };

  // Align the actions under the title. They render as a child of the same
  // ListItem, whose content padding (px="$3") already insets them, so we only add
  // the avatar column: its width (Token "$10" = 40, or compact "$8" = 32) plus the
  // content row's "$3" gap (12). No icon means no avatar column, so no inset.
  const avatarSize = compact ? 32 : 40;
  const titleColumnInset = showIcon ? avatarSize + 12 : 0;

  return (
    <XStack
      pl={titleColumnInset}
      testID="history-list-item-speed-up-and-cancel-buttons"
      pb="$1"
    >
      {renderReplaceButtons()}
      {checkSpeedUpStateEnabled ? renderCheckSpeedUpState() : null}
    </XStack>
  );
}

function BaseTxHistoryListItem(props: IProps) {
  const {
    historyTx,
    tableLayout,
    onPress,
    showIcon,
    hideValue,
    compact,
    recomputeLayout,
  } = props;

  const handlePress = useCallback(
    () => onPress?.(historyTx),
    [onPress, historyTx],
  );

  if (!historyTx || !historyTx.decodedTx) return null;

  const displayStatus = getHistoryTxDisplayStatus(historyTx);
  const isPending = displayStatus === EDecodedTxStatus.Pending;

  // A pending row is just one ListItem in column layout: the token/balance row on
  // top, and the speed-up/cancel actions below as its second child. Because they
  // live in the same ListItem, navigation (onPress) and the press/hover highlight
  // cover the row + actions as a single container automatically — no wrapper,
  // state or platform branching needed. The action Buttons stop press propagation
  // by default, so tapping them runs their action instead of navigating.
  return (
    <TxHistoryListItemErrorBoundary>
      <TxActionsListView
        hideValue={hideValue}
        key={historyTx.id}
        replaceType={historyTx.replacedType}
        decodedTx={historyTx.decodedTx}
        tableLayout={tableLayout}
        showIcon={showIcon}
        componentType={ETxActionComponentType.ListView}
        componentProps={{
          onPress: handlePress,
          children: isPending ? (
            <PendingTxActions
              historyTx={historyTx}
              showIcon={showIcon}
              compact={compact}
              recomputeLayout={recomputeLayout}
            />
          ) : undefined,
        }}
        displayStatus={displayStatus}
        compact={compact}
      />
    </TxHistoryListItemErrorBoundary>
  );
}

// memo: a confirmed tx row's appearance only changes when its historyTx
// identity (or display flags) change. Without this, every parent re-render
// during scroll re-mounts/re-renders every visible row + its hooks.
const TxHistoryListItem = memo(BaseTxHistoryListItem);

export { TxHistoryListItem };
