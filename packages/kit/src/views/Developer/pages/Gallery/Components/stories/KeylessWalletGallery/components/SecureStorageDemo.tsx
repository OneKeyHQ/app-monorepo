import { useState } from 'react';

import {
  Button,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import secureStorage from '@onekeyhq/shared/src/storage/secureStorage';

export const SecureStorageDemo = () => {
  const [secureStorageKey, setSecureStorageKey] = useState('test_secure_key');
  const [secureStorageValue, setSecureStorageValue] =
    useState('test_secure_value');
  const [secureStorageResult, setSecureStorageResult] = useState('');

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Support Secure Storage:{' '}
      </SizableText>

      <YStack gap="$2">
        <SizableText size="$bodyMd">Key:</SizableText>
        <Input
          value={secureStorageKey}
          onChangeText={setSecureStorageKey}
          placeholder="Enter key"
        />
      </YStack>

      <YStack gap="$2">
        <SizableText size="$bodyMd">Value:</SizableText>
        <Input
          value={secureStorageValue}
          onChangeText={setSecureStorageValue}
          placeholder="Enter value"
        />
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="small"
          onPress={async () => {
            try {
              await secureStorage.setSecureItemWithBiometrics(
                secureStorageKey,
                secureStorageValue,
                {
                  authenticationPrompt: 'Authenticate to save secure item',
                },
              );
              setSecureStorageResult(
                `✅ Set with biometrics success: ${secureStorageKey}`,
              );
            } catch (e: any) {
              setSecureStorageResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Set with Biometrics
        </Button>
        <Button
          size="small"
          onPress={async () => {
            try {
              await secureStorage.setSecureItemWithBiometrics(
                secureStorageKey,
                secureStorageValue,
              );
              setSecureStorageResult(
                `✅ Set with biometrics success: ${secureStorageKey}`,
              );
            } catch (e: any) {
              setSecureStorageResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Set with Biometrics(No Prompt)
        </Button>

        <Button
          size="small"
          onPress={async () => {
            try {
              await secureStorage.setSecureItem(
                secureStorageKey,
                secureStorageValue,
              );
              setSecureStorageResult(`✅ Set success: ${secureStorageKey}`);
            } catch (e: any) {
              setSecureStorageResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Set (No Biometrics)
        </Button>

        <Button
          size="small"
          onPress={async () => {
            try {
              const result = await secureStorage.getSecureItem(
                secureStorageKey,
              );
              setSecureStorageResult(
                result !== null
                  ? `✅ Get success: ${result}`
                  : `⚠️ Key not found: ${secureStorageKey}`,
              );
            } catch (e: any) {
              setSecureStorageResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Get Item
        </Button>

        <Button
          size="small"
          variant="destructive"
          onPress={async () => {
            try {
              await secureStorage.removeSecureItem(secureStorageKey);
              setSecureStorageResult(`✅ Removed: ${secureStorageKey}`);
            } catch (e: any) {
              setSecureStorageResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Remove Item
        </Button>
      </XStack>

      {secureStorageResult ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$bodyMd" selectable>
            {secureStorageResult}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
};
