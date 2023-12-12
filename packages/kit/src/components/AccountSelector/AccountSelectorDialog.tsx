import { useEffect, useMemo, useState } from 'react';

import { Accordion, Paragraph, Square } from 'tamagui';

import { Button, Select, Text, TextArea } from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import { mockPresetNetworks } from '@onekeyhq/kit-bg/src/mock';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { wait } from '../../utils/helper';

import { AccountSelectorActiveAccount } from './AccountSelectorActiveAccount';

const getNetworksItems = memoFn(() =>
  // TODO ETC network
  Object.values(mockPresetNetworks).map((item) => ({
    value: item.id,
    label: item.name,
  })),
);

const { serviceAccount, servicePassword } = backgroundApiProxy;
export function AccountSelectorDialog({ num }: { num: number }) {
  useEffect(
    () => () => {
      console.log('DemoAccountSelector unload');
    },
    [],
  );
  const [text, setText] = useState<string>(
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  );
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();

  // TODO move to jotai
  const { result: deriveInfoItems = [] } = usePromiseResult(async () => {
    if (!selectedAccount.networkId) {
      return [];
    }
    const map = await serviceAccount.getDeriveInfoMapOfNetwork({
      networkId: selectedAccount.networkId,
    });
    return Object.entries(map).map(([k, v]) => ({
      value: k,
      item: v,
      label:
        (v.labelKey
          ? appLocale.intl.formatMessage({ id: v.labelKey })
          : v.label) || k,
    }));
  }, [selectedAccount.networkId]);
  const currentDeriveInfo = useMemo(
    () =>
      deriveInfoItems.find((item) => item.value === selectedAccount.deriveType),
    [deriveInfoItems, selectedAccount.deriveType],
  );

  const { result: walletsResult, run: refreshWallets } = usePromiseResult(
    () => serviceAccount.getWallets(),
    [],
  );
  const wallets = walletsResult?.wallets;

  const { result: accountsResult, run: refreshAccounts } =
    usePromiseResult(async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }
      return serviceAccount.getAccountsOfWallet({
        walletId: selectedAccount?.focusedWallet,
      });
    }, [selectedAccount?.focusedWallet]);
  const accounts = accountsResult?.accounts;

  return (
    <>
      <Text variant="$headingXl">
        账户选择器 {selectedAccount?.indexedAccountId}
      </Text>
      <Text>
        focusedWallet({wallets?.length}): {selectedAccount.focusedWallet}
      </Text>

      {wallets?.length && wallets?.length > 0 ? (
        <Accordion
          overflow="hidden"
          width="full"
          type="single"
          value={selectedAccount.focusedWallet}
          onValueChange={(id) =>
            actions.current.updateSelectedAccount({
              num,
              builder: (v) => ({
                ...v,
                focusedWallet: id,
              }),
            })
          }
        >
          {wallets?.map((wallet) => {
            if (!accountUtils.isHdWallet({ walletId: wallet.id })) {
              return null;
            }
            return (
              <Accordion.Item key={wallet.id} value={wallet.id}>
                <Accordion.Trigger
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <Paragraph>
                        {wallet.avatarInfo?.emoji} {wallet.name} ({wallet.id}) [
                        {accounts?.length}]
                      </Paragraph>
                      <Square
                        animation="quick"
                        rotate={open ? '90deg' : '0deg'}
                      >
                        <Text>➡️</Text>
                      </Square>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.Content backgroundColor="#eee">
                  {accounts?.map((a) => (
                    <Text
                      onPress={() => {
                        actions.current.updateSelectedAccount({
                          num,
                          builder: (v) => ({
                            ...v,
                            walletId: wallet.id,
                            accountId: undefined,
                            indexedAccountId: a.id,
                          }),
                        });
                      }}
                      key={a.id}
                    >
                      {a.name} ({a?.walletId}) index={a.index}
                      {'   '}
                      {selectedAccount.indexedAccountId === a.id ? '✅' : ''}
                    </Text>
                  ))}
                  <Button
                    onPress={async () => {
                      const c = await serviceAccount.addHDNextIndexedAccount({
                        walletId: wallet.id,
                      });
                      console.log(c);
                      await refreshAccounts();
                    }}
                  >
                    + Add Account
                  </Button>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion>
      ) : null}

      <Text variant="$headingXl">网络选择器 {selectedAccount.networkId}</Text>
      <Select
        items={getNetworksItems()}
        value={selectedAccount.networkId}
        onValueChange={(id) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              networkId: id,
            }),
          })
        }
        triggerProps={{ width: '100%' }}
        disablePreventBodyScroll
        title="网络"
      />

      <Text variant="$headingXl">
        派生选择器{' '}
        {accountUtils.beautifyPathTemplate({
          template: currentDeriveInfo?.item?.template || '',
        })}
      </Text>
      <Select
        items={deriveInfoItems}
        value={selectedAccount.deriveType}
        onValueChange={(type) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              deriveType: type as any,
            }),
          })
        }
        triggerProps={{ width: '100%' }}
        disablePreventBodyScroll
        title="派生类型"
      />

      <Text variant="$headingXl">当前账户</Text>
      {/* <Suspense></Suspense> */}
      <AccountSelectorActiveAccount num={num} />

      <>
        <Text variant="$heading5xl">添加 HD 钱包</Text>

        <Button
          onPress={async () => {
            setText(generateMnemonic());
          }}
        >
          🔄
        </Button>
        <TextArea
          value={text}
          onChangeText={(t) => setText(t)}
          placeholder="输入助记词"
        />
        <Button
          onPress={async () => {
            const {
              data: { password },
            } = await servicePassword.promptPasswordVerify();
            const mnemonic = await servicePassword.encodeSensitiveText({
              text,
            });
            const wallet = await serviceAccount.createHDWallet({
              mnemonic,
              password,
            });
            console.log('hd wallet created: ', wallet);
            if (wallet) {
              await refreshWallets();
              await wait(300);
              actions.current.updateSelectedAccount({
                num,
                builder: (v) => ({
                  ...v,
                  focusedWallet: wallet.id,
                }),
              });
            }
          }}
        >
          + HD 钱包
        </Button>
        <Button
          variant="destructive"
          onPress={async () => {
            const mnemonic = await servicePassword.encodeSensitiveText({
              text,
            });
            await serviceAccount.createHDWallet({
              // mnemonic: text,
              mnemonic,
              password: '11111111',
            });
          }}
        >
          + HD 钱包 (参数不加密)
        </Button>
      </>
    </>
  );
}
