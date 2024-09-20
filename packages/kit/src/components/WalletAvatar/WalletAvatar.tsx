import { isNil } from 'lodash';

import type { SizeTokens } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import type { IWalletProps } from '../../views/AccountManagerStacks/type';
import type { IDeviceType } from '@onekeyfe/hd-core';

export type IWalletAvatarBaseProps = {
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames | IDeviceType; // use img for WalletAvatarEdit
  wallet: IDBWallet | undefined;
};
export type IWalletAvatarProps = IWalletAvatarBaseProps & {
  status?: IWalletProps['status'];
  badge?: number | string;
};

export function WalletAvatarBase({
  size,
  img,
  wallet,
}: IWalletAvatarBaseProps) {
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
      {status === 'connected' ? (
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
      ) : null}
      {!isNil(badge) ? (
        <Stack
          position="absolute"
          h="$4"
          px="$0.5"
          justifyContent="center"
          bottom={-2}
          right={-1}
          bg="$bgSubdued"
          borderRadius="$full"
          zIndex="$1"
        >
          <SizableText size="$bodySm" textAlign="center">
            {badge}
          </SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}
