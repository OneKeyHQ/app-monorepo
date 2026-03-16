import { EFirmwareType } from '@onekeyfe/hd-shared';
import { isNil } from 'lodash';

import type { IStackProps, SizeTokens } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { NetworkAvatar } from '../NetworkAvatar';

import { getWalletAvatarProvider } from './getWalletAvatarProvider';

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
  firmwareTypeBadge?: EFirmwareType;
  firmwareTypeProps?: IStackProps & { badgeSize?: number };
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
    return <Icon size={size || '$10'} name="LockSolid" />;
  }

  return (
    <Image
      size={size}
      source={AllWalletAvatarImages[theImg] ?? AllWalletAvatarImages.bear}
      fallback={
        <Image.Fallback
          w={size}
          h={size}
          justifyContent="center"
          alignItems="center"
        >
          <SizableText>{wallet?.avatarInfo?.emoji ?? ''}</SizableText>
        </Image.Fallback>
      }
    />
  );
}

export function WalletAvatar({
  size = '$10',
  status,
  badge,
  firmwareTypeBadge,
  img,
  wallet,
  firmwareTypeProps,
}: IWalletAvatarProps) {
  const socialLoginProvider = getWalletAvatarProvider(wallet);
  const { badgeSize, ...restFirmwareTypeProps } = firmwareTypeProps ?? {};

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
      {firmwareTypeBadge === EFirmwareType.BitcoinOnly ? (
        <Stack
          position="absolute"
          h="$4"
          px="$0.5"
          justifyContent="center"
          top={-4}
          left={0}
          borderRadius="$full"
          zIndex="$1"
          {...restFirmwareTypeProps}
        >
          <NetworkAvatar
            networkId={presetNetworksMap.btc.id}
            size={badgeSize ?? 14}
          />
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
      {/* Keyless wallet social login provider icon */}
      {status === 'keyless' ? (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          bg="$bgApp"
          p="$0.5"
          borderRadius="$full"
          zIndex="$1"
        >
          {socialLoginProvider === EOAuthSocialLoginProvider.Google ? (
            <Icon name="GoogleIllus" size="$3.5" />
          ) : (
            <Icon name="AppleBrand" size="$3.5" color="$iconActive" />
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
