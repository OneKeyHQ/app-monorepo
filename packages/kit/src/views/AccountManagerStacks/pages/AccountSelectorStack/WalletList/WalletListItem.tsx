import { useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, Tooltip, useMedia } from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IWalletListItemProps = {
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IDBWallet | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  onWalletLongPress?: (focusedWallet: IAccountSelectorFocusedWallet) => void;
} & IStackProps &
  Partial<IWalletAvatarProps>;

export function WalletListItem({
  wallet,
  focusedWallet,
  onWalletPress,
  onWalletLongPress,
  isOthers,
  badge,
  ...rest
}: IWalletListItemProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const media = useMedia();
  let walletAvatarProps: IWalletAvatarProps = {
    wallet,
    status: 'default', // 'default' | 'connected';
    badge,
  };
  let walletName = wallet?.name;
  let selected = focusedWallet === wallet?.id;
  let onPress = () => wallet?.id && onWalletPress(wallet?.id);
  let onLongPress = () => wallet?.id && onWalletLongPress?.(wallet?.id);
  if (isOthers) {
    walletName = 'Others';
    selected = focusedWallet === '$$others';
    walletAvatarProps = {
      img: 'cardDividers',
      wallet: undefined,
    };
    onPress = () => onWalletPress('$$others');
    onLongPress = () => undefined;
  }
  const hiddenWallets = wallet?.hiddenWallets;

  // Use the walletName that has already been processed by i18n in background,
  // otherwise, every time the walletName is displayed elsewhere, it will need to be processed by i18n again.
  const i18nWalletName = walletName;
  // const i18nWalletName = intl.formatMessage({
  //   id: walletName as ETranslations,
  // });

  const basicComponentContent = (
    <Stack
      role="button"
      alignItems="center"
      p="$1"
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
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
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      {...(!platformEnv.isNative
        ? {
            onPress,
          }
        : undefined)}
      {...rest}
    >
      {walletAvatarProps ? <WalletAvatar {...walletAvatarProps} /> : null}
      <SizableText
        flex={1}
        width="100%"
        numberOfLines={1}
        mt="$1"
        size="$bodySm"
        color={selected ? '$text' : '$textSubdued'}
        textAlign="center"
      >
        {i18nWalletName}
      </SizableText>
    </Stack>
  );

  const basicComponent = platformEnv.isNative ? (
    <Pressable
      delayLongPress={200}
      pointerEvents="box-only"
      {...{
        onPress,
        onLongPress,
      }}
    >
      {basicComponentContent}
    </Pressable>
  ) : (
    basicComponentContent
  );

  const responsiveComponent = media.md ? (
    <Tooltip
      placement="right"
      renderContent={i18nWalletName}
      renderTrigger={basicComponent}
    />
  ) : (
    basicComponent
  );

  if (hiddenWallets && hiddenWallets.length > 0) {
    return (
      <Stack
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
        gap="$3"
        borderCurve="continuous"
      >
        {responsiveComponent}
        {hiddenWallets.map((hiddenWallet, index) => (
          <WalletListItem
            key={index}
            wallet={hiddenWallet}
            focusedWallet={focusedWallet}
            onWalletPress={onWalletPress}
            onWalletLongPress={onWalletLongPress}
            {...(media.md && {
              badge: Number(index) + 1,
            })}
          />
        ))}
      </Stack>
    );
  }

  return responsiveComponent;
}
