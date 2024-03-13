import { useCallback, useEffect } from 'react';

import { StyleSheet } from 'react-native';

import {
  ListView,
  Page,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AccountSelectorCreateWalletButton } from './AccountSelectorCreateWalletButton';
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
  const { serviceAccount } = backgroundApiProxy;
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
      bg="$bgSubdued"
      borderRightWidth={StyleSheet.hairlineWidth}
      borderRightColor="$neutral3"
    >
      {/* Close action */}
      {(platformEnv.isExtension || platformEnv.isNativeAndroid) && (
        <XStack py="$4" justifyContent="center">
          <Page.Close>
            <HeaderIconButton icon="CrossedLargeOutline" />
          </Page.Close>
        </XStack>
      )}
      {/* Primary wallets */}
      <ListView
        py="$2"
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
        ListFooterComponent={<AccountSelectorCreateWalletButton />}
      />
      {/* Others */}
      <Stack py="$2" mb={bottom}>
        <OthersWalletItem onWalletPress={onWalletPress} num={num} />
      </Stack>
    </Stack>
  );
}
