import { Stack, SizableText } from '@onekeyhq/components';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

// TODO: i18n — replace with ETranslations keys when available
// Keys: tray.tx_send / tray.tx_swap / tray.tx_contract / tray.tx_approve
const TX_TYPE_LABELS: Record<string, string> = {
  send: 'Send',
  swap: 'Swap',
  contract: 'Contract Call',
  approve: 'Approve',
};

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function TxRow({ tx, onPress }: { tx: IPendingTx; onPress: () => void }) {
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
        <SizableText fontSize="$bodyMd" color="$text">{TX_TYPE_LABELS[tx.type] || tx.type}</SizableText>
        <SizableText fontSize="$bodySm" color="$textSubdued">→ {truncateAddress(tx.to)}</SizableText>
      </Stack>
      <Stack alignItems="flex-end">
        <SizableText fontSize="$bodyMd" color="$text">{tx.amount}</SizableText>
        <SizableText fontSize="$bodySm" color="$textWarning">{tx.confirmations || 'Pending'}</SizableText>
      </Stack>
    </Stack>
  );
}

export function PendingTransactions({
  transactions,
  onTxPress,
}: {
  transactions: IPendingTx[];
  onTxPress: (txId: string) => void;
}) {
  if (!transactions || transactions.length === 0) {
    return (
      <Stack padding="$4">
        <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
{/* TODO: i18n tray.no_pending_transactions */}
          No pending transactions
        </SizableText>
      </Stack>
    );
  }

  const displayTxs = transactions.slice(0, 5);
  const hasMore = transactions.length > 5;

  return (
    <Stack>
      <SizableText fontSize="$bodySm" color="$textSubdued" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
{/* TODO: i18n tray.pending_transactions */}
        Pending Transactions
      </SizableText>
      {displayTxs.map((tx) => (
        <TxRow key={tx.id} tx={tx} onPress={() => onTxPress(tx.id)} />
      ))}
      {hasMore ? (
        <Stack padding="$3" onPress={() => onTxPress('')} cursor="pointer">
          {/* TODO: i18n tray.view_all */}
          <SizableText fontSize="$bodySm" color="$textInteractive" textAlign="center">View all →</SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}
