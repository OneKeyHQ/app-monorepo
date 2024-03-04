import { useCallback, useEffect } from 'react';

import { StyleSheet } from 'react-native';

import {
  ActionList,
  IconButton,
  ListView,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletListItem } from './WalletListItem';

function ListItemSeparator() {
  return <Stack h="$3" />;
}

interface IWalletListProps {
  num: number;
}

function OthersWalletItem({
  onWalletPress,
  num,
}: {
  num: number;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
}) {
  const {
    selectedAccount: { focusedWallet },
  } = useSelectedAccount({ num });
  return (
    <WalletListItem
      walletName="Others"
      selected={focusedWallet === '$$others'}
      wallet={undefined}
      onPress={() => onWalletPress && onWalletPress('$$others')}
      walletAvatarProps={{
        img: 'cardDividers',
        wallet: undefined,
      }}
    />
  );
}

export function WalletList({ num }: IWalletListProps) {
  const navigation = useAppNavigation();

  const handleConnectHardwareWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [navigation]);

  const handleCreateWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

  const handleImportWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportRecoveryPhrase,
    });
  }, [navigation]);

  const { serviceAccount } = backgroundApiProxy;
  const media = useMedia();
  const { bottom } = useSafeAreaInsets();
  const actions = useAccountSelectorActions();

  const { selectedAccount } = useSelectedAccount({ num });

  const { result: walletsResult, run: reloadWallets } = usePromiseResult(
    () => serviceAccount.getHDAndHWWallets(),
    [serviceAccount],
    {
      checkIsFocused: false,
    },
  );
  const wallets = walletsResult?.wallets ?? emptyArray;

  useEffect(() => {
    const fn = async () => {
      await reloadWallets();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [reloadWallets]);

  const onWalletPress = useCallback(
    (focusedWallet: IAccountSelectorFocusedWallet) => {
      void actions.current.updateSelectedAccount({
        num,
        builder: (account) => ({
          ...account,
          focusedWallet,
        }),
      });
    },
    [actions, num],
  );

  return (
    <Stack
      $gtMd={{
        w: '$32',
      }}
      py="$2"
      bg="$bgSubdued"
      borderRightWidth={StyleSheet.hairlineWidth}
      borderRightColor="$neutral3"
    >
      {/* Close action */}
      {(platformEnv.isExtension ||
        platformEnv.isNativeAndroid ||
        platformEnv.isWeb) && (
        <XStack px="$5" py="$3.5">
          <Page.Close>
            <HeaderIconButton icon="CrossedLargeOutline" />
          </Page.Close>
        </XStack>
      )}
      {/* Primary wallets */}
      <ListView
        estimatedItemSize="$10"
        data={wallets}
        extraData={selectedAccount.focusedWallet}
        renderItem={({ item }: { item: IDBWallet }) => (
          <WalletListItem
            key={item.id}
            walletName={item.name}
            wallet={item}
            selected={item.id === selectedAccount.focusedWallet}
            onPress={() => onWalletPress && onWalletPress(item.id)}
            walletAvatarProps={{
              wallet: item,
              status: 'default', // 'default' | 'connected';
            }}
          />
        )}
        ItemSeparatorComponent={ListItemSeparator}
        ListFooterComponent={
          <Stack p="$1" alignItems="center" mt="$3">
            <ActionList
              placement="right-start"
              renderTrigger={<IconButton icon="PlusSmallOutline" />}
              title="Add wallet"
              items={[
                {
                  label: 'Connect hardware wallet',
                  icon: platformEnv.isNative
                    ? 'BluetoothOutline'
                    : 'UsbOutline',
                  onPress: handleConnectHardwareWalletPress,
                },
                {
                  label: 'Create new wallet',
                  icon: 'Ai2StarOutline',
                  onPress: handleCreateWalletPress,
                },
                {
                  label: 'Import wallet',
                  icon: 'DownloadOutline',
                  onPress: handleImportWalletPress,
                },
              ]}
            />
            {media.gtMd && (
              <SizableText size="$bodySm" color="$textSubdued" mt="$1">
                Add wallet
              </SizableText>
            )}
          </Stack>
        }
      />
      {/* Others */}
      <Stack pb={bottom}>
        <OthersWalletItem onWalletPress={onWalletPress} num={num} />
      </Stack>
    </Stack>
  );
}
