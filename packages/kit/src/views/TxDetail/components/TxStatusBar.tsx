import { HStack } from '@onekeyhq/components';
import type { IDecodedTx, IHistoryTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementReplacedTxText } from '../elements/TxActionElementReplacedTxText';
import { TxActionElementStatusText } from '../elements/TxActionElementStatusText';
import { TxActionElementTime } from '../elements/TxActionElementTime';

function getTxStatusTextView({ decodedTx }: { decodedTx: IDecodedTx }) {
  const txStatusTextView =
    decodedTx.status !== IDecodedTxStatus.Confirmed ? (
      <TxActionElementStatusText decodedTx={decodedTx} />
    ) : undefined;
  return txStatusTextView;
}

export function TxStatusBarInDetail({ decodedTx }: { decodedTx: IDecodedTx }) {
  const txStatusTextView = getTxStatusTextView({ decodedTx });

  const timeView = (
    <TxActionElementTime
      typography="Body2"
      color="text-subdued"
      timestamp={decodedTx.updatedAt || decodedTx.createdAt || 0}
    />
  );

  const subTitleView = (
    <HStack space={2}>
      {txStatusTextView}
      {timeView}
    </HStack>
  );
  return subTitleView;
}

export function TxStatusBarInList(props: {
  decodedTx: IDecodedTx;
  historyTx: IHistoryTx | undefined;
}) {
  const { historyTx, decodedTx } = props;

  const txStatusTextView = getTxStatusTextView({ decodedTx });

  let replacedTextView = null;
  if (historyTx?.replacedType) {
    replacedTextView = <TxActionElementReplacedTxText historyTx={historyTx} />;
  }

  const statusBarView =
    txStatusTextView || replacedTextView ? (
      <HStack space={2}>
        {txStatusTextView}
        {replacedTextView}
      </HStack>
    ) : undefined;

  return statusBarView ?? null;
}
