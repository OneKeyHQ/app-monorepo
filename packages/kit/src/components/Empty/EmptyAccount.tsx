import { EmptyBase } from './EmptyBase';

function EmptyAccount() {
  return (
    <EmptyBase
      title="No Address"
      description="Create a wallet to get started"
      actions={[{ text: 'Create Wallet', OnPress: () => {} }]}
    />
  );
}

export { EmptyAccount };
