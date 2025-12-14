import { useCallback, useState } from 'react';

import { Button, SizableText, Table, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IKeylessMnemonicInfo } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

interface IGenerateKeylessWalletProps {
  onGenerated?: (mnemonic: string, shares: IKeylessMnemonicInfo) => void;
}

export const GenerateKeylessWallet = ({
  onGenerated,
}: IGenerateKeylessWalletProps) => {
  const [mnemonic, setMnemonic] = useState('');
  const [shares, setShares] = useState<IKeylessMnemonicInfo | null>(null);

  const generateMnemonic = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.generateKeylessMnemonic();

    setMnemonic(result.mnemonic);
    setShares(result);

    onGenerated?.(result.mnemonic, result);
  }, [onGenerated]);

  return (
    <YStack gap="$4">
      <Button onPress={generateMnemonic} variant="primary">
        Generate Mnemonic
      </Button>
      {mnemonic ? (
        <YStack gap="$2">
          <SizableText size="$headingMd">Mnemonic:</SizableText>
          <SizableText>{mnemonic}</SizableText>

          <SizableText size="$headingMd">Shares:</SizableText>
          <Table
            dataSource={[
              { key: 'Device Key', value: shares?.deviceKey },
              { key: 'Cloud Key', value: shares?.cloudKey },
              { key: 'Auth Key', value: shares?.authKey },
              {
                key: 'Device Key Pwd Slice',
                value: shares?.deviceKeyPwdSlice,
              },
              {
                key: 'Cloud Key Pwd Slice',
                value: shares?.cloudKeyPwdSlice,
              },
              {
                key: 'Auth Key Pwd Slice',
                value: shares?.authKeyPwdSlice,
              },
            ]}
            columns={[
              { title: 'Key', dataIndex: 'key', columnWidth: 160 },
              { title: 'Value', dataIndex: 'value', columnWidth: 300 },
            ]}
            keyExtractor={(item: { key: string; value?: string }) => item.key}
            rowProps={{
              borderBottomWidth: 1,
              borderColor: '$borderSubdued',
              borderRadius: 0,
              px: '$3',
              py: 0,
            }}
            headerRowProps={{
              bg: '$bgSubdued',
              borderRadius: 0,
              px: '$3',
              py: '$3',
            }}
          />
        </YStack>
      ) : null}
    </YStack>
  );
};
