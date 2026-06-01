import { memo, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

  return (
    <XStack
      // eslint-disable-next-line no-nested-ternary
      pl={showIcon ? (compact ? 64 : 72) : 20}
      testID="history-list-item-speed-up-and-cancel-buttons"
      pb="$3"
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

  const isPending = historyTx.decodedTx.status === EDecodedTxStatus.Pending;

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
        componentProps={{ onPress: handlePress }}
        compact={compact}
      />
      {isPending ? (
        <PendingTxActions
          historyTx={historyTx}
          showIcon={showIcon}
          compact={compact}
          recomputeLayout={recomputeLayout}
        />
      ) : null}
    </TxHistoryListItemErrorBoundary>
  );
}

// memo: a confirmed tx row's appearance only changes when its historyTx
// identity (or display flags) change. Without this, every parent re-render
// during scroll re-mounts/re-renders every visible row + its hooks.
const TxHistoryListItem = memo(BaseTxHistoryListItem);

export { TxHistoryListItem };
