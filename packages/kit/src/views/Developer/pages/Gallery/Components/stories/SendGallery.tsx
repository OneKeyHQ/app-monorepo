import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from './utils/Layout';

function PartContainer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack>
      <Stack paddingTop="$5" paddingBottom="$2.5">
        <SizableText size="$headingMd">{title}</SizableText>
      </Stack>

      <YStack
        padding="$2.5"
        gap="$5"
        borderColor="$border"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$2"
      >
        {children}
      </YStack>
    </YStack>
  );
}

function ExternalAccountSign() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  return (
    <PartContainer title="ExternalAccountSign">
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceDemo.testEvmPersonalSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
          });
          console.log('Personal Sign result:', r);
          if (r.isVerified) {
            Toast.success({
              title: `Personal Sign success: ${r.signature}`,
            });
          } else {
            Toast.error({
              title: `Personal Sign failed: ${r.signature}`,
            });
          }
        }}
      >
        personal_sign: ({activeAccount.account?.address})
      </Button>

      <Button
        onPress={async () => {
          /*
            rawTx
              "0x02f86d0101830128ed8301d1ac828a109402ba7fd1b0acdd0e4f8c6da7c4ba8fd7f963ba5085012a05f20080c080a0a628a75f3355a5e765a0dcd2844e84254601c55e01ff851bc18e766c6e2c2deca07bca58e8e36f1d3729c47b22b7cc0797317951ea24336a238e0f706f6404d5ec"
            txid
              "0x63a5e9fdc8ae8c6cfb72c5662bee9e84a4c19887d01c25e8180ee10d24ac6601"
          */
          const r = await backgroundApiProxy.serviceDemo.testEvmSendTxSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
            encodedTx: {
              from: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              to: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              gasLimit: '0x8a10',
              maxPriorityFeePerGas: '0x128ed',
              maxFeePerGas: '0x1d1ac',
              data: '0x',
              nonce: '0x1',
              value: '0x12a05f200',
              chainId: '0x1',
              // https://github.com/MetaMask/core/blob/main/packages/transaction-controller/src/types.ts#L860
              // type: '0x2', // legacy = '0x0',  accessList = '0x1',  feeMarket = '0x2',
            },
          });
          console.log('Sign tx success', r);
          Toast.success({
            title: `Sign tx success: ${r.rawTx} ${r.txid}`,
          });
        }}
      >
        sign tx: ({activeAccount.account?.address})
      </Button>

      <Button
        onPress={async () => {
          /*
            rawTx
              "0x02f86d0101830128ed8301d1ac828a109402ba7fd1b0acdd0e4f8c6da7c4ba8fd7f963ba5085012a05f20080c080a0a628a75f3355a5e765a0dcd2844e84254601c55e01ff851bc18e766c6e2c2deca07bca58e8e36f1d3729c47b22b7cc0797317951ea24336a238e0f706f6404d5ec"
            txid
              "0x63a5e9fdc8ae8c6cfb72c5662bee9e84a4c19887d01c25e8180ee10d24ac6601"
          */
          const r = await backgroundApiProxy.serviceDemo.testEvmSendTxSign({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
            encodedTx: {
              from: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              to: '0x02bA7fd1b0aCdd0E4F8c6DA7C4bA8Fd7F963bA50',
              gasLimit: '0x8a10',
              gasPrice: '0x128ed',
              data: '0x',
              nonce: '0x1',
              value: '0x12a05f200',
              chainId: '0x1',
              // https://github.com/MetaMask/core/blob/main/packages/transaction-controller/src/types.ts#L860
              // type: '0x2', // legacy = '0x0',  accessList = '0x1',  feeMarket = '0x2',
            },
          });
          console.log('Sign tx success', r);
          Toast.success({
            title: `Sign tx success: ${r.rawTx} ${r.txid}`,
          });
        }}
      >
        sign legacy tx: ({activeAccount.account?.address})
      </Button>
    </PartContainer>
  );
}

function SendTestButton() {
  const { activeAccount } = useActiveAccount({ num: 0 });

  return (
    <Stack>
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceDemo.demoGetPrivateKey({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
          });
          console.log('getPrivateKeys done:', r);
        }}
      >
        获取私钥
      </Button>

      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceDemo.demoSend({
            networkId: activeAccount.network?.id || '',
            accountId: activeAccount.account?.id || '',
          });
          console.log('demoSend done:', r);
        }}
      >
        测试发送流程(使用首页的账户选择器)
      </Button>
      <SizableText>
        {activeAccount.network?.id}, {activeAccount.account?.id},
        {activeAccount.account?.address}
      </SizableText>
    </Stack>
  );
}

const SendGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
            }}
            enabledNum={[0]}
          >
            <Stack>
              <ExternalAccountSign />
              <SendTestButton />
              <Button
                onPress={() => {
                  void backgroundApiProxy.serviceV4Migration.testShowData();
                }}
              >
                Test v4 migration
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.prepareMigration();
                  console.log(r);
                }}
              >
                prepareMigration
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.getV4WalletsForBackup();
                  console.log(r);
                }}
              >
                getV4WalletsForBackup
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.revealV4HdMnemonic(
                      {
                        hdWalletId: 'hd-1',
                      },
                    );
                  console.log(r);
                }}
              >
                revealV4Mnemonic
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceV4Migration.startV4MigrationFlow();
                  console.log(r);
                }}
              >
                startV4MigrationFlow
              </Button>
            </Stack>
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default SendGallery;
