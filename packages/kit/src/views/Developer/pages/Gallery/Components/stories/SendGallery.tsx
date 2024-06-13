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
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { IV4MigrationImportedCredential } from '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/types';
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
                    await backgroundApiProxy.serviceV4Migration.buildV4WalletsForBackupSectionData();
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
                  const logResult = (r: IV4MigrationImportedCredential) => {
                    console.log('ExportSecretKeys >>>> ', {
                      privateKey: r.exportedPrivateKey,
                      address: r.account.address,
                    });
                    console.log(r);
                  };
                  const accountIds: string[] = [
                    'imported--60--022af46276751943e1447e903076e93d7e47729708d87ac5e2854719a5f1e2ca17',
                    'imported--0--xpub6BthKLEjBd54zLpbuefhkyYTSpfNmLXCHTH2qx68Pk7xK3q15GeEz4y1TXEhwCunAyVFKZhcmjHXGVGsy2e2uf9Dvu3aFuHQpvvg8eBSwRs--',
                    "imported--0--xpub6C4EqF8f7TpvWGTuHhsVdVCfZZr8QtGLQ5nQVcTCy5qMDZXoystKHB8VvZqahU1q446H9KH2DrLzoRERWUyaUSYcSqMgfcxaFMY1eNnJnW5--86'/",
                    'imported--0--ypub6X5Uoa9945krfbaNKhHdvtBaGoU3gHZ4mxgSCHnXoEN6gtFsAR1yiCWC5J2PJ9CdWyWcjvY3Kh4spVgHLv5dhF3K2JM79Ho5h67SGTMWvis--',
                    'imported--0--zpub6qyshJi7r5Au27dvK7UTxcNVVc8NoQFZ96dPF8C33h34oW1zUFMSfswwTYLvuwumy1jq9Cj5spfwBWSt7r5mTEaRTHuaPjEkG9Pqd6iZTf3--',
                  ];
                  for (const accountId of accountIds) {
                    try {
                      const r =
                        await backgroundApiProxy.serviceV4Migration.revealV4ImportedPrivateKey(
                          {
                            password: '11111111',
                            accountId,
                          },
                        );
                      logResult(r);
                    } catch (error) {
                      //
                    }
                  }
                }}
              >
                revealV4ImportedPrivateKey
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
