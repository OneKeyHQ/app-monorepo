import { EmptyBase } from './EmptyBase';

function EmptyWallet() {
  return (
    <EmptyBase
      icon="WalletCryptoOutline"
      title="No Wallet"
      description="Create one to start managing your cryptocurrency safely and efficiently"
      actions={[{ text: 'Create Wallet', OnPress: () => {} }]}
    />
  );
}

export { EmptyWallet };
