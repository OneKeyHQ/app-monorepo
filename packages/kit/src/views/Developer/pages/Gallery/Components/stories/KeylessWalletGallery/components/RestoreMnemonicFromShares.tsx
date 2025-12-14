import { useCallback, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Checkbox,
  SizableText,
  TextAreaInput,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IKeylessMnemonicInfo } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

interface IRestoreMnemonicFromSharesProps {
  shares?: IKeylessMnemonicInfo | null;
  mnemonic?: string;
  onRestore?: (deviceKey: string, cloudKey: string, authKey: string) => void;
}

export const RestoreMnemonicFromShares = ({
  shares,
  mnemonic,
  onRestore,
}: IRestoreMnemonicFromSharesProps) => {
  const [restoreDeviceKey, setRestoreDeviceKey] = useState('');
  const [restoreCloudKey, setRestoreCloudKey] = useState('');
  const [restoreAuthKey, setRestoreAuthKey] = useState('');

  const [useDeviceKey, setUseDeviceKey] = useState(true);
  const [useCloudKey, setUseCloudKey] = useState(true);
  const [useAuthKey, setUseAuthKey] = useState(true);

  const [restoredMnemonic, setRestoredMnemonic] = useState('');
  const [restoredShares, setRestoredShares] = useState<string[]>([]);

  const [recoverAuthKeyResult, setRecoverAuthKeyResult] = useState('');
  const [recoverCloudKeyResult, setRecoverCloudKeyResult] = useState('');
  const [recoverDeviceKeyResult, setRecoverDeviceKeyResult] = useState('');

  const restore = useCallback(async () => {
    try {
      const result =
        await backgroundApiProxy.serviceKeylessWallet.restoreMnemonicFromShareKey(
          {
            deviceKey: useDeviceKey ? restoreDeviceKey : undefined,
            cloudKey: useCloudKey ? restoreCloudKey : undefined,
            authKey: useAuthKey ? restoreAuthKey : undefined,
          },
        );
      setRestoredMnemonic(result.mnemonic);
      setRestoredShares(result.shares);
      onRestore?.(restoreDeviceKey, restoreCloudKey, restoreAuthKey);
    } catch (e: any) {
      setRestoredMnemonic(`Error: ${(e as Error)?.message}`);
      setRestoredShares([]);
    }
  }, [
    restoreAuthKey,
    restoreCloudKey,
    restoreDeviceKey,
    useDeviceKey,
    useCloudKey,
    useAuthKey,
    onRestore,
  ]);

  const restoreRef = useRef<() => void>(null);
  restoreRef.current = restore;

  return (
    <YStack gap="$4">
      <Checkbox
        label="Device Key"
        value={useDeviceKey}
        onChange={(v) => {
          setUseDeviceKey(!!v);
          setTimeout(() => {
            void restoreRef.current?.();
          }, 300);
        }}
      />
      <TextAreaInput
        numberOfLines={2}
        value={restoreDeviceKey}
        onChangeText={setRestoreDeviceKey}
        placeholder="Device Key Hex"
      />
      <Checkbox
        label="Cloud Key"
        value={useCloudKey}
        onChange={(v) => {
          setUseCloudKey(!!v);
          setTimeout(() => {
            void restoreRef.current?.();
          }, 300);
        }}
      />
      <TextAreaInput
        numberOfLines={2}
        value={restoreCloudKey}
        onChangeText={setRestoreCloudKey}
        placeholder="Cloud Key Hex"
      />
      <Checkbox
        label="Auth Key"
        value={useAuthKey}
        onChange={(v) => {
          setUseAuthKey(!!v);
          setTimeout(() => {
            void restoreRef.current?.();
          }, 300);
        }}
      />
      <TextAreaInput
        numberOfLines={2}
        value={restoreAuthKey}
        onChangeText={setRestoreAuthKey}
        placeholder="Auth Key Hex"
      />
      <Button onPress={restore} variant="primary">
        Restore Mnemonic
      </Button>

      {restoredMnemonic ? (
        <YStack gap="$2">
          <SizableText
            size="$headingMd"
            color={
              restoredMnemonic.startsWith('Error') ||
              (mnemonic && restoredMnemonic !== mnemonic)
                ? '$textCritical'
                : '$textSuccess'
            }
          >
            Result:
          </SizableText>
          <SizableText selectable>{restoredMnemonic}</SizableText>
          {mnemonic &&
          restoredMnemonic !== mnemonic &&
          !restoredMnemonic.startsWith('Error') ? (
            <Alert type="danger" title="Mnemonic mismatch!" />
          ) : null}
        </YStack>
      ) : null}
      {restoredShares.length > 0 ? (
        <YStack gap="$2">
          <SizableText size="$headingMd">Restored Shares:</SizableText>
          {restoredShares.map((share, index) => (
            <SizableText key={index} size="$bodySm" numberOfLines={10}>
              {share}
            </SizableText>
          ))}
        </YStack>
      ) : null}

      <YStack gap="$2">
        <Button
          onPress={async () => {
            if (shares?.deviceKeyX === undefined) {
              setRecoverDeviceKeyResult('Error: deviceKeyX is undefined');
              return;
            }
            try {
              const result =
                await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                  {
                    mnemonic: mnemonic || '',
                    shareBase64: restoreAuthKey,
                    missingX: shares.deviceKeyX,
                  },
                );
              setRecoverDeviceKeyResult(JSON.stringify(result, null, 2));
            } catch (e: any) {
              setRecoverDeviceKeyResult(`Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Recover DeviceKey (missingX: {shares?.deviceKeyX})
        </Button>
        {recoverDeviceKeyResult ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {recoverDeviceKeyResult}
          </SizableText>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Button
          onPress={async () => {
            if (shares?.cloudKeyX === undefined) {
              setRecoverCloudKeyResult('Error: cloudKeyX is undefined');
              return;
            }
            try {
              const result =
                await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                  {
                    mnemonic: mnemonic || '',
                    shareBase64: restoreDeviceKey,
                    missingX: shares.cloudKeyX,
                  },
                );
              setRecoverCloudKeyResult(JSON.stringify(result, null, 2));
            } catch (e: any) {
              setRecoverCloudKeyResult(`Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Recover CloudKey (missingX: {shares?.cloudKeyX})
        </Button>
        {recoverCloudKeyResult ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {recoverCloudKeyResult}
          </SizableText>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Button
          onPress={async () => {
            if (shares?.authKeyX === undefined) {
              setRecoverAuthKeyResult('Error: authKeyX is undefined');
              return;
            }
            try {
              const result =
                await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                  {
                    mnemonic: mnemonic || '',
                    shareBase64: restoreDeviceKey,
                    missingX: shares.authKeyX,
                  },
                );
              setRecoverAuthKeyResult(JSON.stringify(result, null, 2));
            } catch (e: any) {
              setRecoverAuthKeyResult(`Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Recover AuthKey (missingX: {shares?.authKeyX})
        </Button>
        {recoverAuthKeyResult ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {recoverAuthKeyResult}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
};
