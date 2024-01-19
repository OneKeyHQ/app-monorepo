import { IconButton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export function WalletRenameButton({ wallet }: { wallet: IDBWallet }) {
  return (
    <IconButton
      title="Rename"
      icon="PencilOutline"
      size="small"
      variant="tertiary"
      $platform-native={{
        hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
      }}
      onPress={async () => {
        showRenameDialog(wallet.name, {
          onSubmit: async (name) => {
            if (wallet?.id && name) {
              const { serviceAccount } = backgroundApiProxy;
              await serviceAccount.setWalletNameAndAvatar({
                walletId: wallet?.id,
                name,
              });
            }
          },
        });
      }}
    />
  );
}
