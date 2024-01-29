import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import type { IWalletProps } from '../../views/AccountManagerStacks/router/types';
import type { SizeTokens } from 'tamagui';

export interface IWalletAvatarProps {
  status?: IWalletProps['status'];
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames;
  wallet: IDBWallet | undefined;
  icon?: IKeyOfIcons;
  onIconPress?: () => void;
}

export function WalletAvatarBase({
  size,
  img,
  wallet,
}: {
  size?: SizeTokens;
  img?: IAllWalletAvatarImageNames;
  wallet: IDBWallet | undefined;
}) {
  const theImg = img || wallet?.avatarInfo?.img;
  if (!theImg) {
    return null;
  }
  return (
    <Image size={size}>
      <Image.Source
        source={AllWalletAvatarImages[theImg] ?? AllWalletAvatarImages.bear}
      />
      <Image.Fallback delayMs={300} justifyContent="center" alignItems="center">
        <SizableText>{wallet?.avatarInfo?.emoji ?? '😀'}</SizableText>
      </Image.Fallback>
    </Image>
  );
}

export function WalletAvatar({
  size = '$10',
  status,
  wallet,
  img,
  icon,
  onIconPress,
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
      {icon ? (
        <Stack
          position="absolute"
          right="$-1"
          bottom="$-1"
          bg="$bgApp"
          p="$px"
          borderRadius="$full"
          zIndex="$1"
          animation="quick"
          hitSlop={
            platformEnv.isNative
              ? { top: 16, left: 16, right: 16, bottom: 16 }
              : undefined
          }
          onPress={onIconPress}
          hoverStyle={{
            scale: 1.25,
          }}
        >
          <Icon size="$4.5" name={icon} />
        </Stack>
      ) : null}
    </Stack>
  );
}
