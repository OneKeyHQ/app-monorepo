import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useReplaceTx } from '../../hooks/useReplaceTx';

import { TxHistoryListItemErrorBoundary } from './TxHistoryListItemErrorBoundary';

type IProps = {
  index: number;
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  showIcon?: boolean;
  tableLayout?: boolean;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout, onPress, showIcon } = props;
  const intl = useIntl();

  const { canReplaceTx, canCancelTx, handleReplaceTx } = useReplaceTx({
    historyTx,
  });

  const renderReplaceTxActions = useCallback(() => {
    if (!canReplaceTx) return null;

    if (historyTx.decodedTx.status !== EDecodedTxStatus.Pending) return null;

    return (
      <XStack
        pl={showIcon ? 72 : 20}
        testID="history-list-item-speed-up-and-cancel-buttons"
        pb="$3"
      >
        {canCancelTx ? (
          <XStack space="$3">
            <Button
              size="small"
              variant="primary"
              onPress={() =>
                handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
              }
            >
              {intl.formatMessage({ id: ETranslations.global_speed_up })}
            </Button>
            <Button
              size="small"
              onPress={() =>
                handleReplaceTx({ replaceType: EReplaceTxType.Cancel })
              }
            >
              {intl.formatMessage({ id: ETranslations.global_cancel })}
            </Button>
          </XStack>
        ) : (
          <Button
            size="small"
            variant="primary"
            onPress={() =>
              handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp })
            }
          >
            {intl.formatMessage({ id: ETranslations.speed_up_cancellation })}
          </Button>
        )}
      </XStack>
    );
  }, [
    canCancelTx,
    canReplaceTx,
    handleReplaceTx,
    historyTx.decodedTx.status,
    intl,
    showIcon,
  ]);

  if (!historyTx || !historyTx.decodedTx) return null;

  return (
    <TxHistoryListItemErrorBoundary>
      <TxActionsListView
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
