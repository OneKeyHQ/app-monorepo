import { Children, isValidElement, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { requestNativeStorageRecovery } from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import {
  type INativeStorageMigrationRecoveryTarget,
  getNativeStorageRecoveryToastTarget,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { Button } from '../../primitives/Button';

const RECOVERY_ACTION_TEST_ID = 'native-storage-repair-toast-action';

function hasRecoveryAction(children: ReactNode): boolean {
  return Children.toArray(children).some((child) =>
    isValidElement<{ testID?: string; children?: ReactNode }>(child)
      ? child.props.testID === RECOVERY_ACTION_TEST_ID ||
        hasRecoveryAction(child.props.children)
      : false,
  );
}

function RecoveryButton({
  target,
  testSessionId,
  onRequestClose,
}: {
  target: INativeStorageMigrationRecoveryTarget;
  testSessionId?: string;
  onRequestClose?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const pending = useRef(false);
  const handlePress = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      await onRequestClose?.();
    } finally {
      requestNativeStorageRecovery(
        target,
        target === 'appStorage' ? testSessionId : undefined,
      );
      pending.current = false;
    }
  }, [onRequestClose, target, testSessionId]);
  return (
    <Button size="small" testID={RECOVERY_ACTION_TEST_ID} onPress={handlePress}>
      {intl.formatMessage({ id: ETranslations.global_retry })}
    </Button>
  );
}

export function NativeStorageRecoveryToastActions({
  title,
  message,
  actions,
  nativeStorageRecoveryTestSessionId,
  onRequestClose,
}: {
  title: string;
  message?: string;
  actions?: ReactNode;
  nativeStorageRecoveryTestSessionId?: string;
  onRequestClose?: () => void | Promise<void>;
}) {
  const target = platformEnv.isNative
    ? getNativeStorageRecoveryToastTarget(title, message)
    : undefined;
  return (
    <>
      {actions}
      {target && !hasRecoveryAction(actions) ? (
        <RecoveryButton
          target={target}
          testSessionId={nativeStorageRecoveryTestSessionId}
          onRequestClose={onRequestClose}
        />
      ) : null}
    </>
  );
}
