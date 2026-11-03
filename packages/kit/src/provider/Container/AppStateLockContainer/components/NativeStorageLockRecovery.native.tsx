import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import {
  Button,
  Icon,
  Keyboard,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { callNativeStorage } from '@onekeyhq/shared/src/storage/nativeStorageBridge';
import {
  getRequestedNativeStorageRecovery,
  requestNativeStorageRecovery,
  subscribeNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import {
  type INativeAppStorageMigrationStatus,
  getNativeStorageRecoveryToastTarget,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

export function useNativeStorageLockError() {
  const [message, setMessage] = useState<string>();
  const recovering = useSyncExternalStore(
    subscribeNativeStorageRecovery,
    getRequestedNativeStorageRecovery,
  );
  useEffect(() => {
    if (recovering) return undefined;
    let active = true;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inspect = async () => {
      if (!active || pending || AppState.currentState === 'background') return;
      clearTimeout(timer);
      pending = true;
      try {
        const status =
          await callNativeStorage<INativeAppStorageMigrationStatus>({
            scope: 'recovery',
            operation: 'inspectAppStorageMigration',
          });
        if (active && status?.errorMessage === null) {
          setMessage(undefined);
        } else if (
          active &&
          status?.errorMessage &&
          getNativeStorageRecoveryToastTarget(status.errorMessage) ===
            'appStorage'
        ) {
          setMessage(status.errorMessage);
        }
      } catch {
        // A readiness/transport failure is not evidence of a missing marker.
        // Keep a confirmed fault until a subsequent owner inspection clears it.
      } finally {
        pending = false;
        if (active) timer = setTimeout(() => void inspect(), 3000);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void inspect();
    });
    void inspect();
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [recovering]);
  return message;
}

function RepairButton({ testID }: { testID: string }) {
  const intl = useIntl();
  const pending = useRef(false);
  const openRepair = useCallback(() => {
    if (pending.current && getRequestedNativeStorageRecovery()) return;
    pending.current = true;
    Keyboard.dismiss();
    // NativeStorageBootstrapRoot replaces the App and its lock window with the
    // existing repair screen. No app navigation, atoms or password bypass.
    requestNativeStorageRecovery('appStorage');
  }, []);
  return (
    <Button size="small" testID={testID} onPress={openRepair}>
      {intl.formatMessage({ id: ETranslations.global_retry })}
    </Button>
  );
}

export function NativeStorageLockError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <YStack gap="$3" mt="$4" testID="lock-storage-error">
      <ScrollView maxHeight={128}>
        <SizableText size="$bodySm" color="$textCritical">
          {message}
        </SizableText>
      </ScrollView>
      <RepairButton testID="lock-storage-repair" />
    </YStack>
  );
}

export function NativeStorageLockToast({ message }: { message?: string }) {
  const { top } = useSafeAreaInsets();
  const [visible, setVisible] = useState(Boolean(message));
  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return undefined;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message || !visible) return null;
  return (
    // This toast lives IN the lock's native window on iOS and IN its high
    // z-index subtree on Android. It also mounts when DetailRouter is deferred.
    // Ordinary global notifications retain their existing lock-screen policy.
    <Stack
      position="absolute"
      top={top + 16}
      left={32}
      right={32}
      zIndex={TOAST_Z_INDEX}
      alignItems="center"
      pointerEvents="box-none"
      testID="lock-storage-toast"
    >
      <YStack
        bg="$bgStrong"
        p="$4"
        borderRadius="$3"
        width="100%"
        maxWidth={640}
        gap="$3"
      >
        <XStack gap="$2">
          <Icon name="ErrorSolid" color="$iconCritical" size="$5" />
          <SizableText size="$headingSm" flex={1}>
            {message}
          </SizableText>
        </XStack>
        <RepairButton testID="native-storage-repair-toast-action" />
      </YStack>
    </Stack>
  );
}
