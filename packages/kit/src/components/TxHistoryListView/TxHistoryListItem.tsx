import { memo, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack, YStack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useReplaceTx } from '../../hooks/useReplaceTx';

import { SpeedUpAction } from './SpeedUpAction';
import { TxHistoryListItemErrorBoundary } from './TxHistoryListItemErrorBoundary';

// Highlight props for the pending-row wrapper. Reuse the shared ListItem
// hover/press tokens so the wrapped block (main row + speed-up/cancel actions)
// highlights exactly like a normal row, from a single source of truth. Press is
// web/desktop only: a pressable wrapper on native would steal the touch
// responder from list scrolling — the row keeps its own native Pressable
// feedback there, and native has no hover. Built once at module load.
const PENDING_ROW_HIGHLIGHT_STYLE = {
  hoverStyle: listItemPressStyle.hoverStyle,
  ...(platformEnv.isNative
    ? undefined
    : { pressStyle: listItemPressStyle.pressStyle }),
};

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
      // Align the actions under the title. The inset is the row's own content
      // padding (px="$3" = 12) plus, when an icon shows, the avatar (40 /
      // compact 32) + gap (12). The wrapper's mx is a shared left origin for
      // both the row and these actions, so it isn't part of this offset.
      // eslint-disable-next-line no-nested-ternary
      pl={showIcon ? (compact ? 56 : 64) : 12}
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

  const displayStatus = getHistoryTxDisplayStatus(historyTx);
  const isPending = displayStatus === EDecodedTxStatus.Pending;

  const listView = (
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
        // Pending rows lift the hover/press highlight to the wrapper below so it
        // spans the row + the speed-up/cancel actions. Drop this row's own inset
        // (the wrapper owns it) and clear its hover/press bg so the translucent
        // overlay isn't painted twice. onPress stays here, so the row remains the
        // navigation target while the sibling action buttons don't open the
        // detail. On native these are no-ops/fallbacks (see ListItem).
        ...(isPending && {
          mx: 0,
          hoverStyle: undefined,
          pressStyle: undefined,
        }),
      }}
      displayStatus={displayStatus}
      compact={compact}
    />
  );

  return (
    <TxHistoryListItemErrorBoundary>
      {isPending ? (
        // Wrap the row + actions so hovering/pressing anywhere highlights the
        // whole item as one continuous, rounded block. The wrapper owns the
        // inset, radius and highlight; the row keeps onPress + its focus ring,
        // and the action buttons keep their own hit areas.
        <YStack
          mx="$2"
          borderRadius="$3"
          borderCurve="continuous"
          {...PENDING_ROW_HIGHLIGHT_STYLE}
        >
          {listView}
          <PendingTxActions
            historyTx={historyTx}
            showIcon={showIcon}
            compact={compact}
            recomputeLayout={recomputeLayout}
          />
        </YStack>
      ) : (
        listView
      )}
    </TxHistoryListItemErrorBoundary>
  );
}

// memo: a confirmed tx row's appearance only changes when its historyTx
// identity (or display flags) change. Without this, every parent re-render
// during scroll re-mounts/re-renders every visible row + its hooks.
const TxHistoryListItem = memo(BaseTxHistoryListItem);

export { TxHistoryListItem };
