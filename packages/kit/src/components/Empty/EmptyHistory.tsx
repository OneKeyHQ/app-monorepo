import { Empty } from '@onekeyhq/components';

function EmptyHistory() {
  return (
    <Empty
      testID="Wallet-No-History-Empty"
      icon="ClockTimeHistoryOutline"
      title="No Transactions Yet"
      description="Your transactions will appear here"
    />
  );
}

export { EmptyHistory };
