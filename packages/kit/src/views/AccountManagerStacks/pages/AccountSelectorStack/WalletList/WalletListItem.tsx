import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, Tooltip, useMedia } from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

type IWalletListItemProps = {
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IDBWallet | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
} & IStackProps &
  Partial<IWalletAvatarProps>;

export function WalletListItem({
  wallet,
  focusedWallet,
  onWalletPress,
  isOthers,
  badge,
  ...rest
}: IWalletListItemProps) {
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
  if (isOthers) {
    walletName = 'Others';
    selected = focusedWallet === '$$others';
    walletAvatarProps = {
      img: 'cardDividers',
      wallet: undefined,
    };
    onPress = () => onWalletPress('$$others');
  }
  const hiddenWallets = wallet?.hiddenWallets;
  const i18nWalletName = intl.formatMessage({
    id: walletName as ETranslations,
  });
  const basicComponent = (
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
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      {...rest}
      onPress={onPress}
    >
      {walletAvatarProps ? <WalletAvatar {...walletAvatarProps} /> : null}
      {media.gtMd ? (
        <SizableText
          flex={1}
          numberOfLines={1}
          mt="$1"
          size="$bodySm"
          color={selected ? '$text' : '$textSubdued'}
        >
          {i18nWalletName}
        </SizableText>
      ) : null}
    </Stack>
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
        space="$3"
        borderCurve="continuous"
      >
        {responsiveComponent}
        {hiddenWallets.map((hiddenWallet, index) => (
          <WalletListItem
            key={index}
            wallet={hiddenWallet}
            focusedWallet={focusedWallet}
            onWalletPress={onWalletPress}
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
