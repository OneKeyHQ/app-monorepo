import { useMemo, useState } from 'react';

import * as crypto from 'crypto';

import { Accordion, Paragraph, Square } from 'tamagui';

import {
  Button,
  Input,
  Select,
  Stack,
  Text,
  TextArea,
} from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { mockPresetNetworks } from '@onekeyhq/kit-bg/src/mock';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ProviderJotaiContextDemo } from '../../../states/jotai/contexts/demo';
import { wait } from '../../../utils/helper';

import { Layout } from './utils/Layout';

const getNetworksItems = memoFn(() =>
  // TODO ETC network
  Object.values(mockPresetNetworks).map((item) => ({
    value: item.id,
    label: item.name,
  })),
);
const { serviceAccount, servicePassword } = backgroundApiProxy;

function DemoAccountSelector() {
  const [text, setText] = useState<string>(
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  );
  const [openWalletId, setOpenWalletId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<{
    walletId: string;
    accountId: string;
    indexedAccount: IDBIndexedAccount | undefined;
  }>({
    walletId: '',
    accountId: '',
    indexedAccount: undefined,
  });

  const [deriveType, setDeriveType] = useState<IAccountDeriveTypes | string>(
    'default',
  );
  const [networkId, setNetworkId] = useState('evm--5');

  const { result: deriveInfoItems = [] } = usePromiseResult(async () => {
    const map = await serviceAccount.getDeriveInfoMapOfNetwork({ networkId });
    return Object.entries(map).map(([k, v]) => ({
      value: k,
      item: v,
      label:
        (v.labelKey
          ? appLocale.intl.formatMessage({ id: v.labelKey })
          : v.label) || k,
    }));
  }, [networkId]);
  const currentDeriveInfo = useMemo(
    () => deriveInfoItems.find((item) => item.value === deriveType),
    [deriveInfoItems, deriveType],
  );

  const { result: walletsResult, run: refreshWallets } = usePromiseResult(
    () => serviceAccount.getWallets(),
    [],
  );
  const wallets = walletsResult?.wallets;

  const { result: accountsResult, run: refreshAccounts } =
    usePromiseResult(async () => {
      if (!openWalletId) {
        return Promise.resolve(undefined);
      }
      return serviceAccount.getAccountsOfWallet({ walletId: openWalletId });
    }, [openWalletId]);
  const accounts = accountsResult?.accounts;

  const { result: currentAccount, run: refreshCurrentAccount } =
    usePromiseResult(
      async () => {
        const r = await serviceAccount.getAccountOfWallet({
          indexedAccountId: selectedAccount?.indexedAccount?.id,
          accountId: selectedAccount.accountId,
          deriveType: deriveType as any,
          networkId,
        });
        return r;
      },
      [deriveType, networkId, selectedAccount],
      {
        undefinedResultIfError: true,
      },
    );

  return (
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
            setOpenWalletId(wallet.id);
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

      <Text variant="$heading5xl">钱包首页</Text>

      <Text variant="$headingXl">
        账户选择器 {selectedAccount?.indexedAccount?.id}
      </Text>

      <Accordion
        overflow="hidden"
        width="full"
        type="single"
        value={openWalletId}
        onValueChange={(v) => setOpenWalletId(v)}
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
                      {wallet.avatarInfo?.emoji} {wallet.name} ({wallet.id})
                    </Paragraph>
                    <Square animation="quick" rotate={open ? '90deg' : '0deg'}>
                      <Text>➡️</Text>
                    </Square>
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.Content backgroundColor="#eee">
                {accounts?.map((a) => (
                  <Text
                    onPress={() => {
                      setSelectedAccount({
                        walletId: wallet.id,
                        accountId: '',
                        indexedAccount: a,
                      });
                    }}
                    key={a.id}
                  >
                    {a.name} ({a?.walletId}) index={a.index}
                    {'   '}
                    {selectedAccount.indexedAccount?.id === a.id ? '✅' : ''}
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

      <Text variant="$headingXl">网络选择器 {networkId}</Text>
      <Select
        items={getNetworksItems()}
        value={networkId}
        onValueChange={setNetworkId}
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
        value={deriveType}
        onValueChange={setDeriveType}
        triggerProps={{ width: '100%' }}
        disablePreventBodyScroll
        title="派生类型"
      />

      <Text variant="$headingXl">账户</Text>
      {currentAccount?.address ? (
        <>
          <Text>
            {accountUtils.shortenAddress({
              address: currentAccount?.address || '',
            })}
          </Text>
          <Text>{currentAccount?.id}</Text>
          <Text>{currentAccount?.path}</Text>
        </>
      ) : (
        <Button
          onPress={async () => {
            const {
              data: { password },
            } = await servicePassword.promptPasswordVerify();
            const c = await serviceAccount.addHDAccounts({
              password,
              walletId: selectedAccount.walletId,
              networkId,
              indexes: [selectedAccount.indexedAccount?.index ?? 0],
              deriveType: deriveType as any,
            });
            console.log(c);
            await refreshCurrentAccount();
          }}
        >
          暂无账户，点击创建
        </Button>
      )}

      <Text>...</Text>
      <Text variant="$heading5xl">SWAP</Text>
      <Text variant="$headingXl">账户选择器2</Text>
      <Text variant="$headingXl">网络选择器2</Text>
      <Text variant="$headingXl">派生选择器2</Text>
      <Text variant="$headingXl">账户2：</Text>
      <Text>...</Text>
      <Text variant="$heading5xl">发现页</Text>
      <Text>app.uniswap.org</Text>
      <Text variant="$headingXl">账户选择器3</Text>
      <Text variant="$headingXl">网络选择器3</Text>
      <Text variant="$headingXl">派生选择器3</Text>
      <Text variant="$headingXl">账户3：</Text>
      <Text>...</Text>

      <Text variant="$heading5xl">发现页</Text>
      <Text>opensea.io</Text>
      <Text variant="$headingXl">账户选择器4</Text>
      <Text variant="$headingXl">网络选择器4</Text>
      <Text variant="$headingXl">派生选择器4</Text>
      <Text variant="$headingXl">账户4：</Text>
      <Text>...</Text>
    </>
  );
}

function Demo() {
  const [hdId, setHdId] = useState<string>('hd-1');

  return (
    <Stack space="$2">
      <Input value={hdId} onChangeText={(t) => setHdId(t)} />
      <Button
        onPress={async () => {
          const result = await serviceAccount.getWallet({ walletId: hdId });
          console.log(
            '获取 HD 钱包',
            result,
            result?.avatar,
            typeof result?.avatar,
          );
        }}
      >
        获取 HD 钱包
      </Button>
      <Button
        onPress={async () => {
          const {
            data: { password },
          } = await servicePassword.promptPasswordVerify();
          const c = await serviceAccount.getCredentialDecrypt({
            password,
            credentialId: hdId,
          });
          console.log(c);
        }}
      >
        解密 Credentials
      </Button>

      <Button
        onPress={async () => {
          const c = await serviceAccount.addHDIndexedAccount({
            walletId: hdId,
            indexes: [0],
            skipIfExists: false,
          });
          console.log(c);
        }}
      >
        重复添加 HD IndexedAccount 报错
      </Button>
      <Button
        onPress={async () => {
          const c = await serviceAccount.addHDIndexedAccount({
            walletId: hdId,
            indexes: [0],
            skipIfExists: true,
          });
          console.log(c);
        }}
      >
        重复添加 HD IndexedAccount 不报错
      </Button>
      <Button
        onPress={() => {
          const buff = crypto.randomBytes(32);
          console.log(buff.toString('hex'));
        }}
      >
        Test getRandomBytes
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.servicePassword.clearCachedPassword();
        }}
      >
        清空缓存密码
      </Button>
      <DemoAccountSelector />
    </Stack>
  );
}

const AccountModelGallery = () => (
  <ProviderJotaiContextDemo>
    <Layout
      description="Account Model"
      suggestions={['Account Model']}
      boundaryConditions={['Account Model']}
      elements={[
        {
          title: 'Account Model',
          element: (
            <Stack space="$1">
              <Demo />
            </Stack>
          ),
        },
      ]}
    />
  </ProviderJotaiContextDemo>
);

export default AccountModelGallery;
