import { ListItem } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletAvatar } from '../../../../../components/WalletAvatar';
import { showWalletAvatarEditDialog } from '../../../WalletAvatarEdit';
import { WalletRenameButton } from '../../../WalletRename';

export function WalletProfile({ wallet }: { wallet: IDBWallet }) {
  return (
    <ListItem
      renderAvatar={
        <>
          <WalletAvatar size="$10" wallet={wallet} />
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
        </>
      }
      // renderIcon={null}
    >
      <ListItem.Text primary={wallet?.name} />
      <WalletRenameButton wallet={wallet} />
    </ListItem>
  );
}
