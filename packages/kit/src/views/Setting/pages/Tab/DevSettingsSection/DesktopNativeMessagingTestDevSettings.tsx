import { useCallback } from 'react';

import { Dialog, Page, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import desktopNativeMessaging from '@onekeyhq/shared/src/desktopNativeMessaging/extensionNativeMessagingClient';

export default function DesktopNativeMessagingTestDevSettings() {
  const testPing = useCallback(async () => {
    const result = await desktopNativeMessaging.ping();
    Dialog.debugMessage({
      debugMessage: result,
    });
  }, []);

  const testSafeStorageRoundTrip = useCallback(async () => {
    const value = `safe-storage-plaintext-${Date.now()}`;
    const availableResult =
      await desktopNativeMessaging.safeStorage.isAvailable();
    const encryptResult =
      await desktopNativeMessaging.safeStorage.encryptString({
        value,
      });

    if (!encryptResult.supported) {
      Dialog.debugMessage({
        debugMessage: {
          availableResult,
          encryptResult,
        },
      });
      return;
    }

    const decryptResult =
      await desktopNativeMessaging.safeStorage.decryptString({
        encryptedText: encryptResult.payload,
      });

    Dialog.debugMessage({
      debugMessage: {
        availableResult,
        encryptResult: {
          ...encryptResult,
          payload: `${encryptResult.payload.slice(0, 24)}...`,
          payloadLength: encryptResult.payload.length,
        },
        decryptResult,
        matched: decryptResult.supported && decryptResult.payload === value,
      },
    });
  }, []);

  const testSafeStorageFailureCases = useCallback(async () => {
    const result =
      await desktopNativeMessaging.safeStorage.runDevSettingsFailureCases();
    Dialog.debugMessage({
      debugMessage: result,
    });
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="Desktop Native Messaging" />
      <YStack gap="$2">
        <ListItem
          title="ping desktop native host"
          subtitle="Returns unsupported if desktop host is not registered"
          drillIn
          onPress={testPing}
        />
        <ListItem
          title="owner-bound safeStorage round trip"
          subtitle="Encrypts via Desktop host and signs decrypt with extension CryptoKey"
          drillIn
          onPress={testSafeStorageRoundTrip}
        />
        <ListItem
          title="owner-bound safeStorage failure cases"
          subtitle="Checks tampered blob and owner mismatch protocol errors"
          drillIn
          onPress={testSafeStorageFailureCases}
        />
      </YStack>
    </Page>
  );
}
