import type { SizeTokens } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import type { IWalletProps } from '../../views/AccountManagerStacks/type';

export type IWalletAvatarBaseProps = {
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames; // use img for WalletAvatarEdit
  wallet: IDBWallet | undefined;
};
export type IWalletAvatarProps = IWalletAvatarBaseProps & {
  status?: IWalletProps['status'];
  badge?: number;
};

export function WalletAvatarBase({
  size,
  img,
  wallet,
}: {
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames; // use img for WalletAvatarEdit
  wallet: IDBWallet | undefined;
}) {
  const theImg = img || wallet?.avatarInfo?.img;
  if (!theImg) {
    return null;
  }
  const isHidden = accountUtils.isHwHiddenWallet({
    wallet,
  });

  if (isHidden) {
    return <Icon size="$10" name="LockSolid" color="$iconSubdued" />;
  }

  return (
    <Image size={size}>
      <Image.Source
        source={AllWalletAvatarImages[theImg] ?? AllWalletAvatarImages.bear}
      />

      <Image.Fallback delayMs={300} justifyContent="center" alignItems="center">
        <SizableText>{wallet?.avatarInfo?.emoji ?? ''}</SizableText>
      </Image.Fallback>
    </Image>
  );
}

export function WalletAvatar({
  size = '$10',
  status,
  badge,
  img,
  wallet,
}: IWalletAvatarProps) {
  return (
    <Stack w={size} h={size} justifyContent="center" alignItems="center">
      <WalletAvatarBase size={size} img={img} wallet={wallet} />
      {status === 'connected' && (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          bg="$bgSidebar"
          p="$0.5"
          borderRadius="$full"
          zIndex="$1"
        >
          <Stack borderRadius="$full" w="$2.5" h="$2.5" bg="$bgSuccessStrong" />
        </Stack>
      )}
      {badge && (
        <Stack
          position="absolute"
          bottom={-3}
          right={0}
          bg="$bgSubdued"
          w="$3.5"
          h="$3.5"
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          zIndex="$1"
        >
          <SizableText size="$bodySmMedium" textAlign="center">
            {badge}
          </SizableText>
        </Stack>
      )}
    </Stack>
  );
}
