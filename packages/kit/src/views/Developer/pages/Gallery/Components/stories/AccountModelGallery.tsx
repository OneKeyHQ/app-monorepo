import { useState } from 'react';

import * as crypto from 'crypto';

import { Button, Input, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorActiveAccountLegacy,
  AccountSelectorProviderMirror,
  AccountSelectorTriggerLegacy,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
        enabledNum={[0, 1]}
        config={{
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTriggerLegacy num={0} />
        <AccountSelectorActiveAccountLegacy num={0} />

        <AccountSelectorTriggerLegacy num={1} />
        <AccountSelectorActiveAccountLegacy num={1} />
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
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
              sceneUrl: '',
            }}
            enabledNum={[0]}
          >
            <Stack space="$1">
              <Demo />
            </Stack>
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default AccountModelGallery;
