import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  ActionList,
  IconButton,
  ListView,
  Page,
  Stack,
  Text,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../../../states/jotai/contexts/accountSelector';

import { WalletListItem } from './WalletListItem';

function ListItemSeparator() {
  return <Stack h="$3" />;
}

interface IWalletListProps {
  num: number;
}

export function WalletList({ num }: IWalletListProps) {
  const { serviceAccount } = backgroundApiProxy;
  const media = useMedia();
  const { bottom } = useSafeAreaInsets();
  const actions = useAccountSelectorActions();

  const { selectedAccount } = useSelectedAccount({ num });

  const { result: walletsResult, run: reloadWallets } = usePromiseResult(
    () => serviceAccount.getHDWallets(),
    [serviceAccount],
  );
  const wallets = walletsResult?.wallets ?? emptyArray;

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
                  onPress: () => {
                    console.log('action1');
                  },
                },
                {
                  label: 'Create new wallet',
                  icon: 'Ai2StarOutline',
                  onPress: async () => {
                    console.log('action2');

                    const { wallet, indexedAccount } =
                      await serviceAccount.createHDWallet({
                        mnemonic: generateMnemonic(),
                      });

                    actions.current.updateSelectedAccount({
                      num: 0,
                      builder: (v) => ({
                        ...v,
                        indexedAccountId: indexedAccount.id,
                        walletId: wallet.id,
                        focusedWallet: wallet.id,
                      }),
                    });
                    await reloadWallets();
                  },
                },
                {
                  label: 'Import wallet',
                  icon: 'DownloadOutline',
                  onPress: () => {
                    console.log('action2');
                  },
                },
              ]}
            />
            {media.gtMd && (
              <Text variant="$bodySm" color="$textSubdued" mt="$1">
                Add wallet
              </Text>
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
          onPress={() => onWalletPress && onWalletPress('$$other')}
          walletAvatarProps={{
            img: 'cardDividers',
            wallet: undefined,
          }}
        />
      </Stack>
    </Stack>
  );
}
