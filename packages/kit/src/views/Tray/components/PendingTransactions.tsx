import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

const TX_TYPE_TRANSLATION_KEY: Record<string, ETranslations> = {
  send: ETranslations.tray_tx_type_send,
  swap: ETranslations.tray_tx_type_swap,
  contract: ETranslations.tray_tx_type_contract_call,
  approve: ETranslations.tray_tx_type_approve,
};

function TxRow({
  tx,
  typeLabel,
  pendingLabel,
  onPress,
}: {
  tx: IPendingTx;
  typeLabel: string;
  pendingLabel: string;
  onPress: () => void;
}) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flex={1}>
        <SizableText fontSize="$bodyMd" color="$text">
          {typeLabel}
        </SizableText>
        <SizableText fontSize="$bodySm" color="$textSubdued">
          → {accountUtils.shortenAddress({ address: tx.to })}
        </SizableText>
      </Stack>
      <Stack alignItems="flex-end">
        <SizableText fontSize="$bodyMd" color="$text">
          {tx.amount}
        </SizableText>
        <SizableText fontSize="$bodySm" color="$textWarning">
          {tx.confirmations || pendingLabel}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export function PendingTransactions({
  transactions,
  onTxPress,
  onViewAll,
}: {
  transactions: IPendingTx[];
  onTxPress: (txId: string) => void;
  onViewAll: () => void;
}) {
  const intl = useIntl();
  const pendingLabel = intl.formatMessage({
    id: ETranslations.tray_pending_status,
  });

  // Failed txs stay in `transactions` for diffAndNotify; don't show them here.
  const visibleTxs = (transactions || []).filter(
    (tx) => tx.status === 'pending',
  );

  if (visibleTxs.length === 0) {
    return (
      <Stack padding="$4">
        <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.tray_no_pending_transactions_desc,
          })}
        </SizableText>
      </Stack>
    );
  }

  const displayTxs = visibleTxs.slice(0, 5);
  const hasMore = visibleTxs.length > 5;

  return (
    <Stack>
      <SizableText
        fontSize="$bodySm"
        color="$textSubdued"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$1"
      >
        {intl.formatMessage({
          id: ETranslations.tray_pending_transactions_title,
        })}
      </SizableText>
      {displayTxs.map((tx) => {
        const keyId = TX_TYPE_TRANSLATION_KEY[tx.type];
        const typeLabel = keyId ? intl.formatMessage({ id: keyId }) : tx.type;
        return (
          <TxRow
            key={tx.id}
            tx={tx}
            typeLabel={typeLabel}
            pendingLabel={pendingLabel}
            onPress={() => onTxPress(tx.id)}
          />
        );
      })}
      {hasMore ? (
        <Stack padding="$3" onPress={onViewAll} cursor="pointer">
          <SizableText
            fontSize="$bodySm"
            color="$textInteractive"
            textAlign="center"
          >
            {intl.formatMessage({ id: ETranslations.tray_view_all })} →
          </SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}
