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
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { getBotWalletNameBadges } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useAccountSelectorStatusAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { BOT_WALLET_STATUS_DEACTIVATED } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAddHiddenWallet } from '../WalletDetails/hooks/useAddHiddenWallet';

import type { IAccountSelectorWalletInfo } from '../../../type';

type IWalletListItemProps = {
  isEditMode?: boolean;
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IAccountSelectorWalletInfo | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  onWalletLongPress?: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  shouldShowCreateHiddenWalletButtonFn?: (params: {
    wallet: IDBWallet | undefined;
  }) => boolean;
  /** Whether this hardware wallet is currently connected via USB */
  isConnected?: boolean;
} & IStackProps &
  Partial<IWalletAvatarProps>;

function WalletListItemBaseView({
  selected,
  opacity,
  onPress,
  onLongPress,
  avatarView,
  name,
  nameMetaView,
  ...rest
}: ComponentProps<typeof Stack> & {
  selected: boolean;
  avatarView: React.ReactNode;
  name: string | undefined;
  nameMetaView?: React.ReactNode;
}) {
  const media = useMedia();

  const basicComponentContent = (
    <Stack
      role="button"
      alignItems="center"
      p="$1"
      borderRadius="$3"
      $platform-ios={{
        borderRadius: '$5',
      }}
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
      {nameMetaView}
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
  isConnected,
  ...rest
}: IWalletListItemProps) {
  const isKeylessWallet = wallet?.isKeyless;
  const isBotWalletItem = accountUtils.isBotWallet({ walletId: wallet?.id });

  // Determine wallet avatar status
  const getWalletStatus = (): IWalletAvatarProps['status'] => {
    if (isKeylessWallet) return 'keyless';
    if (isConnected) return 'connected';
    return 'default';
  };

  let walletAvatarProps: IWalletAvatarProps = {
    wallet,
    status: getWalletStatus(),
    badge,
    bottomRightBadgeView: isBotWalletItem ? (
      <Icon name="BotIllus" size="$3.5" />
    ) : undefined,
    firmwareTypeBadge: wallet?.firmwareTypeAtCreated,
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
  const botWallets = wallet?.botWallets;
  const isHwOrQrWallet = accountUtils.isHwOrQrWallet({ walletId: wallet?.id });
  const isHiddenWallet = accountUtils.isHwHiddenWallet({ wallet });
  const botNameBadges = getBotWalletNameBadges({
    isBotWallet: isBotWalletItem,
    isBotWalletDeactivated: wallet?.botStatus === BOT_WALLET_STATUS_DEACTIVATED,
  });
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
      nameMetaView={
        botNameBadges.length ? (
          <XStack
            mt="$1"
            gap="$1"
            justifyContent="center"
            flexWrap="wrap"
            width="100%"
          >
            {botNameBadges.map((badgeItem) => (
              <Stack
                key={badgeItem.key}
                px="$1.5"
                py="$0.5"
                borderRadius="$1"
                backgroundColor={
                  badgeItem.tone === 'caution'
                    ? '$bgCautionSubdued'
                    : '$bgSubdued'
                }
              >
                <SizableText
                  size="$bodyXs"
                  color={
                    badgeItem.tone === 'caution'
                      ? '$textCaution'
                      : '$textSubdued'
                  }
                >
                  {badgeItem.label}
                </SizableText>
              </Stack>
            ))}
          </XStack>
        ) : null
      }
      {...rest}
    />
  );

  const shouldShowCreateHiddenWalletButton =
    shouldShowCreateHiddenWalletButtonFn?.({
      wallet,
    });
  let childWallets: IAccountSelectorWalletInfo[] = [];
  if (isHwOrQrWallet) {
    childWallets = hiddenWallets ?? [];
  } else if (isKeylessWallet) {
    childWallets = botWallets ?? [];
  }
  const shouldRenderGroupedWallets =
    !isHiddenWallet &&
    (childWallets.length > 0 || shouldShowCreateHiddenWalletButton);

  if (shouldRenderGroupedWallets) {
    const shouldShowBorder =
      childWallets.length > 0 || shouldShowCreateHiddenWalletButton;

    return (
      <Stack
        borderRadius="$3"
        $platform-ios={{
          borderRadius: '$5',
        }}
        borderWidth={shouldShowBorder ? 1 : 0}
        borderColor="$borderSubdued"
        gap="$3"
        borderCurve="continuous"
        bg="$bgSubdued"
      >
        {content}
        {childWallets.map((childWallet, index) => (
          <WalletListItem
            key={index}
            wallet={childWallet}
            focusedWallet={focusedWallet}
            onWalletPress={onWalletPress}
            onWalletLongPress={onWalletLongPress}
            // Hidden wallets should never show connection status
            isConnected={false}
            {...(media.md && {
              badge: isHwOrQrWallet ? Number(index) + 1 : undefined,
            })}
          />
        ))}
        {isHwOrQrWallet &&
        !isHiddenWallet &&
        shouldShowCreateHiddenWalletButton ? (
          <HiddenWalletAddButton wallet={wallet} isEditMode={isEditMode} />
        ) : null}
      </Stack>
    );
  }

  return content;
}
