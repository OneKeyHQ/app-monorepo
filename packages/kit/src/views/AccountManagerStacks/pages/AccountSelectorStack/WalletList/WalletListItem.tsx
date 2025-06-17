import { type ComponentProps, useCallback, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Stack,
  Toast,
  Tooltip,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

type IWalletListItemProps = {
  isEditMode?: boolean;
  isOthers?: boolean;
  focusedWallet: IAccountSelectorFocusedWallet;
  wallet: IDBWallet | undefined;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
  onWalletLongPress?: (focusedWallet: IAccountSelectorFocusedWallet) => void;
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

export function useAddHiddenWalletButton() {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [isLoading, setIsLoading] = useState(false);
  const { createQrWallet } = useCreateQrWallet();

  const createHwHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      try {
        setIsLoading(true);
        await actions.current.createHWHiddenWallet(
          {
            walletId: wallet?.id || '',
          },
          {
            addDefaultNetworkAccounts: true,
            showAddAccountsLoading: true,
          },
        );
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.global_success,
          }),
        });
      } finally {
        setIsLoading(false);
        const device =
          await backgroundApiProxy.serviceAccount.getWalletDeviceSafe({
            walletId: wallet?.id || '',
          });
        if (device?.connectId) {
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: device?.connectId,
              hardClose: true,
            },
          );
        }
      }
    },
    [actions, intl],
  );

  const createQrHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      try {
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
          },
          isSoftwareWalletOnlyUser: false,
        });

        await createQrWallet({
          isOnboarding: true,
          onFinalizeWalletSetupError: () => {
            // only pop when finalizeWalletSetup pushed
            // navigation.pop();
          },
        });

        defaultLogger.account.wallet.walletAdded({
          status: 'success',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
        defaultLogger.account.wallet.walletAdded({
          status: 'failure',
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
            communication: 'QRCode',
            deviceType: EDeviceType.Pro,
          },
          isSoftwareWalletOnlyUser: false,
        });
        throw error;
      }
    },
    [createQrWallet],
  );

  const createHiddenWallet = useCallback(
    async ({ wallet }: { wallet?: IDBWallet }) => {
      if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
        await createHwHiddenWallet({ wallet });
      }
      if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
        await createQrHiddenWallet({ wallet });
      }
    },
    [createHwHiddenWallet, createQrHiddenWallet],
  );

  return {
    createHiddenWallet,
    isLoading,
  };
}

function HiddenWalletAddButton({
  wallet,
  isEditMode,
}: {
  wallet?: IDBWallet;
  isEditMode?: boolean;
}) {
  const { createHiddenWallet, isLoading } = useAddHiddenWalletButton();
  const intl = useIntl();

  if (!isEditMode || wallet?.deprecated) {
    return null;
  }

  return (
    <WalletListItemBaseView
      name={intl.formatMessage({ id: ETranslations.global_hidden_wallet })}
      avatarView={
        <Icon name="PlusCircleOutline" color="$iconSubdued" size="$10" />
      }
      selected={false}
      onPress={async () => {
        if (isLoading) {
          return;
        }
        await createHiddenWallet({ wallet });
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
  ...rest
}: IWalletListItemProps) {
  let walletAvatarProps: IWalletAvatarProps = {
    wallet,
    status: 'default', // 'default' | 'connected';
    badge,
  };
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
    return (
      <Stack
        borderRadius="$3"
        borderWidth={1}
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
        {!isHiddenWallet ? (
          <HiddenWalletAddButton wallet={wallet} isEditMode={isEditMode} />
        ) : null}
      </Stack>
    );
  }

  return content;
}
