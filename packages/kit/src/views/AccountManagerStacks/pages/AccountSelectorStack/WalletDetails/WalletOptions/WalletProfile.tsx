import { Stack, Tooltip } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { showWalletAvatarEditDialog } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletAvatarEdit';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletProfile({ wallet }: { wallet: IDBWallet }) {
  return (
    <ListItem
      space="$1.5"
      renderAvatar={
        <Stack
          role="button"
          borderRadius="$2"
          {...(accountUtils.isHdWallet({ walletId: wallet.id }) && {
            onPress: () => showWalletAvatarEditDialog({ wallet }),
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
            focusable: true,
            focusStyle: {
              outlineOffset: 2,
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            },
          })}
        >
          <Stack>
            <WalletAvatar size="$10" wallet={wallet} />
            {accountUtils.isHdWallet({ walletId: wallet.id }) ? (
              <ListItem.Avatar.CornerIcon
                name="MenuCircleHorSolid"
                color="$iconSubdued"
              />
            ) : null}
          </Stack>
        </Stack>
      }
      // renderIcon={null}
    >
      <WalletRenameButton wallet={wallet} />
    </ListItem>
  );
}
