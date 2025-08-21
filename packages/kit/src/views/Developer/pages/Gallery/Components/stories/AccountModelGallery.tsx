import { useState } from 'react';

import * as crypto from 'crypto';

import {
  Button,
  Divider,
  Input,
  Select,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from './utils/Layout';

const { serviceAccount, servicePassword, serviceDemo } = backgroundApiProxy;

function HyperLiquidAgentCredentialDemo() {
  const [userAddress, setUserAddress] = useState<string>(
    '0x1234567890123456789012345678901234567890',
  );
  const [agentName, setAgentName] = useState<EHyperLiquidAgentName>(
    EHyperLiquidAgentName.Desktop,
  );
  const [addedCredential, setAddedCredential] = useState<string>('');
  const [retrievedCredential, setRetrievedCredential] = useState<string>('');
  const [updatedCredential, setUpdatedCredential] = useState<string>('');
  const [addCredentialError, setAddCredentialError] = useState<string>('');
  const [getCredentialError, setGetCredentialError] = useState<string>('');
  const [updateCredentialError, setUpdateCredentialError] =
    useState<string>('');

  return (
    <>
      <Divider />
      <SizableText size="$heading2xl">HyperLiquid Agent Credential</SizableText>
      <Input
        placeholder="User Address"
        value={userAddress}
        onChangeText={(t) => setUserAddress(t)}
      />
      <Select
        title="Agent Name"
        items={Object.values(EHyperLiquidAgentName).map((name) => ({
          label: name || 'Official',
          value: name,
        }))}
        value={agentName}
        onChange={setAgentName}
      />

      <Button
        onPress={async () => {
          try {
            // Clear previous error
            setGetCredentialError('');
            setRetrievedCredential('');

            const credential =
              await serviceAccount.getHyperLiquidAgentCredential({
                userAddress,
                agentName,
              });
            console.log('Retrieved HyperLiquid agent credential:', credential);
            setRetrievedCredential(JSON.stringify(credential, null, 2));
          } catch (error) {
            console.error('Failed to get HyperLiquid agent credential:', error);
            setGetCredentialError((error as Error)?.message || String(error));
            setRetrievedCredential('');
          }
        }}
      >
        Get HyperLiquid Agent Credential
      </Button>
      <SizableText size="$heading2xl">Retrieved Credential: </SizableText>
      <SizableText size="$bodyMd" style={{ fontFamily: 'monospace' }}>
        {retrievedCredential || `credential not found`}
      </SizableText>
      {getCredentialError ? (
        <SizableText
          size="$bodyMd"
          color="$textCritical"
          style={{ fontFamily: 'monospace' }}
        >
          Error: {getCredentialError}
        </SizableText>
      ) : null}

      <Button
        onPress={async () => {
          try {
            // Clear previous error
            setAddCredentialError('');
            setAddedCredential('');

            // Generate random private key using crypto.randomBytes
            const privateKeyBytes = crypto.randomBytes(32);
            const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);
            console.log('Generated private key:', privateKeyHex);

            // Encode private key as sensitive text
            const encodedPrivateKey =
              await backgroundApiProxy.servicePassword.encodeSensitiveText({
                text: privateKeyHex,
              });

            // Add HyperLiquid agent credential
            const result = await serviceAccount.addHyperLiquidAgentCredential({
              userAddress,
              agentName,
              privateKey: encodedPrivateKey,
            });
            console.log('Added HyperLiquid agent credential:', result);
            setAddedCredential(
              JSON.stringify(
                {
                  credentialId: result.credentialId,
                  userAddress,
                  agentName,
                  privateKey: privateKeyHex,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            console.error('Failed to add HyperLiquid agent credential:', error);
            setAddCredentialError((error as Error)?.message || String(error));
            setAddedCredential('');
          }
        }}
      >
        Add HyperLiquid Agent Credential
      </Button>
      <SizableText size="$heading2xl">Added Credential: </SizableText>
      {addedCredential ? (
        <SizableText size="$bodyMd" style={{ fontFamily: 'monospace' }}>
          {addedCredential}
        </SizableText>
      ) : null}
      {addCredentialError ? (
        <SizableText
          size="$bodyMd"
          color="$textCritical"
          style={{ fontFamily: 'monospace' }}
        >
          Error: {addCredentialError}
        </SizableText>
      ) : null}

      <Button
        onPress={async () => {
          try {
            // Clear previous error
            setUpdateCredentialError('');
            setUpdatedCredential('');

            // Generate new random private key using crypto.randomBytes
            const privateKeyBytes = crypto.randomBytes(32);
            const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);
            console.log('Generated new private key:', privateKeyHex);

            // Encode private key as sensitive text
            const encodedPrivateKey =
              await backgroundApiProxy.servicePassword.encodeSensitiveText({
                text: privateKeyHex,
              });

            // Update HyperLiquid agent credential
            const result =
              await serviceAccount.updateHyperLiquidAgentCredential({
                userAddress,
                agentName,
                privateKey: encodedPrivateKey,
              });
            console.log('Updated HyperLiquid agent credential:', result);
            setUpdatedCredential(
              JSON.stringify(
                {
                  credentialId: result.credentialId,
                  userAddress,
                  agentName,
                  privateKey: privateKeyHex,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            console.error(
              'Failed to update HyperLiquid agent credential:',
              error,
            );
            setUpdateCredentialError(
              (error as Error)?.message || String(error),
            );
            setUpdatedCredential('');
          }
        }}
      >
        Update HyperLiquid Agent Credential
      </Button>
      <SizableText size="$heading2xl">Updated Credential: </SizableText>
      {updatedCredential ? (
        <SizableText size="$bodyMd" style={{ fontFamily: 'monospace' }}>
          {updatedCredential}
        </SizableText>
      ) : null}
      {updateCredentialError ? (
        <SizableText
          size="$bodyMd"
          color="$textCritical"
          style={{ fontFamily: 'monospace' }}
        >
          Error: {updateCredentialError}
        </SizableText>
      ) : null}
    </>
  );
}

function Demo() {
  const [hdId, setHdId] = useState<string>('hd-1');

  const {
    activeAccount: { device },
  } = useActiveAccount({ num: 0 });

  return (
    <Stack gap="$2">
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
          const c = await serviceAccount.addIndexedAccount({
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
          const c = await serviceAccount.addIndexedAccount({
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

      <Divider />

      {process.env.NODE_ENV !== 'production' ? (
        <HyperLiquidAgentCredentialDemo />
      ) : null}

      <Divider />
      <Divider />
      <Divider />
      <Button
        onPress={async () => {
          const result = await serviceDemo.demoHwGetBtcPublicKeysByLoop({
            connectId: device?.connectId,
            deviceId: device?.deviceId,
          });
          console.log(result);
        }}
      >
        hw 批量创建地址公钥 （循环方式）
      </Button>
      <Button
        onPress={async () => {
          const result = await serviceDemo.demoHwGetAllNetworkAddresses({
            connectId: device?.connectId,
            deviceId: device?.deviceId,
          });
          console.log(result);
        }}
      >
        hw 批量创建地址 （sdk allNetwork api 方式）
      </Button>
    </Stack>
  );
}

const AccountModelGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="AccountModel"
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
            <Stack gap="$1">
              <Demo />
            </Stack>
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default AccountModelGallery;
