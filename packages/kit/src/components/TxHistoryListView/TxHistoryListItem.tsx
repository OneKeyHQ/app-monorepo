import { useCallback } from 'react';

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
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout, onPress, showIcon, hideValue } = props;
  const intl = useIntl();

  const {
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    handleReplaceTx,
    handleCheckSpeedUpState,
  } = useReplaceTx({
    historyTx,
  });

  const renderReplaceTxActions = useCallback(() => {
    if (!canReplaceTx && !checkSpeedUpStateEnabled) return null;

    if (historyTx.decodedTx.status !== EDecodedTxStatus.Pending) return null;

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

    const renderSpeedUpCancelAction = () => (
      <>
        {speedUpCancelEnabled ? (
          <Button
            size="small"
            variant="primary"
            onPress={() =>
              handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
            }
          >
            {intl.formatMessage({
              id: ETranslations.speed_up_cancellation,
            })}
          </Button>
        ) : null}
      </>
    );

    const renderCheckSpeedUpState = () => (
      <Button
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
        pl={showIcon ? 72 : 20}
        testID="history-list-item-speed-up-and-cancel-buttons"
        pb="$3"
      >
        {renderReplaceButtons()}
        {checkSpeedUpStateEnabled ? renderCheckSpeedUpState() : null}
      </XStack>
    );
  }, [
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    canReplaceTx,
    handleReplaceTx,
    handleCheckSpeedUpState,
    historyTx.decodedTx.status,
    historyTx.decodedTx.networkId,
    intl,
    showIcon,
  ]);

  if (!historyTx || !historyTx.decodedTx) return null;

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
          onPress: () => onPress?.(historyTx),
          // ...(tableLayout &&
          //   index % 2 && {
          //     bg: '$bgSubdued',
          //   }),
        }}
      />
      {renderReplaceTxActions()}
    </TxHistoryListItemErrorBoundary>
  );
}

export { TxHistoryListItem };
