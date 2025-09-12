import { type ComponentProps, useEffect } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Stack,
  Tooltip,
  useMedia,
} from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useAccountSelectorStatusAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAddHiddenWallet } from '../WalletDetails/hooks/useAddHiddenWallet';

type IWalletListItemProps = {
  isEditMode?: boolean;
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IDBWallet | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  onWalletLongPress?: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  shouldShowCreateHiddenWalletButtonFn?: (params: {
    wallet: IDBWallet | undefined;
  }) => boolean;
} & IStackProps &
  Partial<IWalletAvatarProps>;

function WalletListItemBaseView({
  selected,
  opacity,
  onPress,
  onLongPress,
  avatarView,
  name,
  ...rest
}: ComponentProps<typeof Stack> & {
  selected: boolean;
  avatarView: React.ReactNode;
  name: string | undefined;
}) {
  const media = useMedia();

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
      opacity={opacity}
      {...(!platformEnv.isNative
        ? {
            onPress,
          }
        : undefined)}
      {...rest}
    >
      {avatarView}
      <SizableText
        flex={1}
        width="100%"
        numberOfLines={1}
        mt="$1"
        size="$bodySm"
        color={selected ? '$text' : '$textSubdued'}
        textAlign="center"
      >
        {name}
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
      renderContent={name}
      renderTrigger={basicComponent}
    />
  ) : (
    basicComponent
  );
  return responsiveComponent;
}

function HiddenWalletAddButton({
  wallet,
  isEditMode,
}: {
  wallet?: IDBWallet;
  isEditMode?: boolean;
}) {
  const { createHiddenWalletWithDialogConfirm, isLoading } =
    useAddHiddenWallet();
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  if (
    !isEditMode ||
    wallet?.deprecated ||
    !settings.showAddHiddenInWalletSidebar
  ) {
    return null;
  }

  return (
    <WalletListItemBaseView
      name={intl.formatMessage({ id: ETranslations.global_hidden_wallet })}
      avatarView={
        <Stack
          h="$10"
          w="$10"
          justifyContent="center"
          alignItems="center"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$full"
          borderStyle="dashed"
        >
          <Icon name="PlusSmallOutline" color="$iconSubdued" />
        </Stack>
      }
      selected={false}
      onPress={async () => {
        if (isLoading) {
          return;
        }
        await createHiddenWalletWithDialogConfirm({ wallet });
      }}
    />
  );
}

export function WalletListItem({
  wallet,
  focusedWallet,
  onWalletPress,
  onWalletLongPress, // drag and drop
  isOthers,
  badge,
  isEditMode,
  shouldShowCreateHiddenWalletButtonFn,
  ...rest
}: IWalletListItemProps) {
  let walletAvatarProps: IWalletAvatarProps = {
    wallet,
    status: 'default', // 'default' | 'connected';
    badge,
  };
  const [accountSelectorStatus] = useAccountSelectorStatusAtom();
  noop(accountSelectorStatus?.passphraseProtectionChangedAt);
  const media = useMedia();
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
  const isHwOrQrWallet = accountUtils.isHwOrQrWallet({ walletId: wallet?.id });
  const isHiddenWallet = accountUtils.isHwHiddenWallet({ wallet });
  const [settings, setSettings] = useSettingsPersistAtom();

  useEffect(() => {
    if (settings?.showAddHiddenInWalletSidebar === undefined) {
      setSettings(
        (prev): ISettingsPersistAtom => ({
          ...prev,
          showAddHiddenInWalletSidebar: true,
        }),
      );
    }
  }, [settings?.showAddHiddenInWalletSidebar, setSettings]);

  // Use the walletName that has already been processed by i18n in background,
  // otherwise, every time the walletName is displayed elsewhere, it will need to be processed by i18n again.
  const i18nWalletName = walletName;
  // const i18nWalletName = intl.formatMessage({
  //   id: walletName as ETranslations,
  // });

  const content = (
    <WalletListItemBaseView
      selected={selected}
      opacity={wallet?.deprecated ? 0.5 : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      avatarView={
        walletAvatarProps ? <WalletAvatar {...walletAvatarProps} /> : null
      }
      name={i18nWalletName}
      {...rest}
    />
  );

  if (isHwOrQrWallet && !isHiddenWallet) {
    const shouldShowCreateHiddenWalletButton =
      shouldShowCreateHiddenWalletButtonFn?.({
        wallet,
      });

    const shouldShowBorder =
      hiddenWallets?.length || shouldShowCreateHiddenWalletButton;

    return (
      <Stack
        borderRadius="$3"
        borderWidth={shouldShowBorder ? 1 : 0}
        borderColor="$borderSubdued"
        gap="$3"
        borderCurve="continuous"
        bg="$bgSubdued"
      >
        {content}
        {(hiddenWallets || []).map((hiddenWallet, index) => (
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
        {!isHiddenWallet && shouldShowCreateHiddenWalletButton ? (
          <HiddenWalletAddButton wallet={wallet} isEditMode={isEditMode} />
        ) : null}
      </Stack>
    );
  }

  return content;
}
