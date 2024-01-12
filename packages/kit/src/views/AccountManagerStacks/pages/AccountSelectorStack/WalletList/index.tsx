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
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../../../routes/Modal/type';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../../../../states/jotai/contexts/accountSelector';
import { EOnboardingPages } from '../../../../Onboarding/router/type';

import { WalletListItem } from './WalletListItem';

function ListItemSeparator() {
  return <Stack h="$3" />;
}

interface IWalletListProps {
  num: number;
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
    () => serviceAccount.getHDWallets(),
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
      actions.current.updateSelectedAccount({
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
      {(platformEnv.isExtension || platformEnv.isNativeAndroid) && (
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
        <WalletListItem
          walletName="Others"
          selected={false}
          wallet={undefined}
          onPress={() => onWalletPress && onWalletPress('$$others')}
          walletAvatarProps={{
            img: 'cardDividers',
            wallet: undefined,
          }}
        />
      </Stack>
    </Stack>
  );
}
