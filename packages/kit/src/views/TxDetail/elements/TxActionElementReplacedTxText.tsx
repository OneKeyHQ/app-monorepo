import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';

export function getReplacedTxTextKey({
  historyTx,
}: {
  historyTx?: IHistoryTx;
}) {
  let text: LocaleIds | undefined;
  if (historyTx?.replacedType === 'cancel') {
    text = 'form__cancelled_transaction';
  }
  if (historyTx?.replacedType === 'speedUp') {
    text = 'form__accelerated_transaction';
  }
  return text;
}

export function getReplacedTxAlertTextKeys({
  historyTx,
}: {
  historyTx?: IHistoryTx;
}) {
  let texts: Array<LocaleIds | undefined> = [];
  if (historyTx?.replacedType === 'cancel') {
    texts = [
      'msg__this_is_a_transaction_for_cancellation' as any,
      'msg__this_is_a_transaction_for_cancellation_desc' as any,
    ];
  }
  if (historyTx?.replacedType === 'speedUp') {
    texts = [
      'msg__this_is_an_accelerated_transaction' as any,
      'msg__this_is_an_accelerated_transaction_desc' as any,
    ];
  }
  return texts;
}

function TxActionElementReplacedTxText(
  props: ComponentProps<typeof Text> & {
    historyTx: IHistoryTx;
  },
) {
  const { historyTx, ...others } = props;
  const intl = useIntl();
  const key = getReplacedTxTextKey({ historyTx });
  const text = key ? intl.formatMessage({ id: key }) : '';
  return (
    <Text typography="Body2" color="text-subdued" {...others}>
      {text}
    </Text>
  );
}

export { TxActionElementReplacedTxText };
