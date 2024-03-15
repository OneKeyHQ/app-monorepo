import { Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export function WalletRenameButton({ wallet }: { wallet: IDBWallet }) {
  const { serviceAccount } = backgroundApiProxy;
  return (
    <XStack
      py="$1"
      px="$1.5"
      alignItems="center"
      userSelect="none"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusStyle={{
        outlineOffset: 2,
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={async () => {
        showRenameDialog(wallet.name, {
          onSubmit: async (name) => {
            if (wallet?.id && name) {
              await serviceAccount.setWalletNameAndAvatar({
                walletId: wallet?.id,
                name,
              });
            }
          },
        });
      }}
    >
      <SizableText size="$bodyLgMedium" pr="$1.5">
        {wallet?.name}
      </SizableText>
      <Icon flexShrink={0} name="PencilSolid" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
