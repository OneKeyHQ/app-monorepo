import { EmptyBase } from './EmptyBase';

function EmptyHistory() {
  return (
    <EmptyBase
      icon="ClockTimeHistoryOutline"
      title="No Transactions Yet"
      description="Your transactions will appear here"
    />
  );
}

export { EmptyHistory };
