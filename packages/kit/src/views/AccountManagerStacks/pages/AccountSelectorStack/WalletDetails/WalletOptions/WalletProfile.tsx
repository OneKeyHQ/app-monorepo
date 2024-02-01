import { Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { showWalletAvatarEditDialog } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletAvatarEdit';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletProfile({ wallet }: { wallet: IDBWallet }) {
  return (
    <ListItem
      renderAvatar={
        <Stack>
          <WalletAvatar size="$10" wallet={wallet} />
          {accountUtils.isHdWallet({ walletId: wallet.id }) ? (
            <ListItem.Avatar.CornerIcon
              name="MenuCircleHorSolid"
              containerProps={{
                animation: 'quick',
                hitSlop: platformEnv.isNative
                  ? { top: 16, left: 16, right: 16, bottom: 16 }
                  : undefined,
                hoverStyle: {
                  scale: 1.25,
                },
                onPress: () => showWalletAvatarEditDialog({ wallet }),
              }}
            />
          ) : null}
        </Stack>
      }
      // renderIcon={null}
    >
      <ListItem.Text primary={wallet?.name} />
      <WalletRenameButton wallet={wallet} />
    </ListItem>
  );
}
