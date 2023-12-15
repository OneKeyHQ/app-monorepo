import { useState } from 'react';

import * as crypto from 'crypto';

import { Button, Input, Stack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
} from '../../../../../../components/AccountSelector';

import { Layout } from './utils/Layout';

const { serviceAccount, servicePassword } = backgroundApiProxy;

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
          const { password } = await servicePassword.promptPasswordVerify();
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

      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTrigger num={0} />
        <AccountSelectorActiveAccount num={0} />

        <AccountSelectorTrigger num={1} />
        <AccountSelectorActiveAccount num={1} />
      </AccountSelectorProviderMirror>
    </Stack>
  );
}

const AccountModelGallery = () => (
  <Layout
    description="Account Model"
    suggestions={['Account Model']}
    boundaryConditions={['Account Model']}
    elements={[
      {
        title: 'Account Model',
        element: (
          <AccountSelectorProvider
            config={{
              sceneName: EAccountSelectorSceneName.home,
              sceneUrl: '',
            }}
            enabledNum={[0]}
          >
            <Stack space="$1">
              <Demo />
            </Stack>
          </AccountSelectorProvider>
        ),
      },
    ]}
  />
);

export default AccountModelGallery;
