import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, useMedia } from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

interface IWalletListItemProps extends IStackProps {
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IDBWallet | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
}

export function WalletListItem({
  wallet,
  focusedWallet,
  onWalletPress,
  isOthers,
  ...rest
}: IWalletListItemProps) {
  const media = useMedia();
  let walletAvatarProps: IWalletAvatarProps = {
    wallet,
    status: 'default', // 'default' | 'connected';
  };
  let walletName = wallet?.name;
  let selected = focusedWallet === wallet?.id;
  let onPress = () => wallet?.id && onWalletPress(wallet?.id);
  if (isOthers) {
    walletName = 'Others';
    selected = focusedWallet === '$$others';
    walletAvatarProps = {
      img: 'cardDividers',
      wallet: undefined,
    };
    onPress = () => onWalletPress('$$others');
  }

  const walletElement = (
    <Stack
      role="button"
      alignItems="center"
      mx="$2"
      p="$1"
      borderRadius="$3"
      style={{
        borderCurve: 'continuous',
      }}
      userSelect="none"
      // hidden wallet use dark bg
      // bg={accountUtils.isHwHiddenWallet({ wallet }) ? '$bgInfo' : undefined}
      {...(selected
        ? {
            bg: '$bgActive',
          }
        : {
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
      focusable
      focusStyle={{
        outlineOffset: 2,
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      {...rest}
      onPress={onPress}
    >
      {walletAvatarProps ? <WalletAvatar {...walletAvatarProps} /> : null}
      {media.gtMd && (
        <SizableText
          flex={1}
          numberOfLines={1}
          mt="$1"
          size="$bodySm"
          color={selected ? '$text' : '$textSubdued'}
        >
          {walletName}
        </SizableText>
      )}
    </Stack>
  );

  const hiddenWallets = wallet?.hiddenWallets;
  if (hiddenWallets && hiddenWallets.length > 0) {
    return (
      <Stack
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
        space="$3"
        style={{
          borderCurve: 'continuous',
        }}
      >
        {walletElement}
        {hiddenWallets.map((hiddenWallet) => (
          <WalletListItem
            wallet={hiddenWallet}
            focusedWallet={focusedWallet}
            onWalletPress={onWalletPress}
          />
        ))}
      </Stack>
    );
  }

  return walletElement;
}
