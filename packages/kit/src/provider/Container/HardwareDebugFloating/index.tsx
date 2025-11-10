import { memo, useCallback, useEffect, useState } from 'react';

import { Button, Portal, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

const FloatingCard = memo(({ children }: { children: React.ReactNode }) => (
  <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
    <Stack
      position="absolute"
      top="$2"
      right="$2"
      p="$3"
      gap="$2"
      bg="$bgStrong"
      borderRadius="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
      zIndex={9999}
      maxWidth={280}
      shadowColor="$textInverse"
      shadowRadius="$4"
      shadowOpacity={0.2}
    >
      {children}
    </Stack>
  </Portal.Body>
));

const BaseHardwareDebugFloatingContainer = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  const [connectId, setConnectId] = useState('');
  const [busy, setBusy] = useState(false);
  const { result: connectedDevices = [], run: refreshDevices } =
    usePromiseResult<IHwQrWalletWithDevice[]>(
      async () => {
        const result =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: true,
            skipDuplicateDevice: true,
          });
        return Object.values(result).filter(
          (item): item is IHwQrWalletWithDevice =>
            Boolean(item.device?.connectId),
        );
      },
      [],
      {
        checkIsFocused: false,
      },
    );

  useEffect(() => {
    if (!connectId && connectedDevices.length > 0) {
      const first = connectedDevices[0]?.device?.connectId;
      if (first) setConnectId(first);
    }
  }, [connectId, connectedDevices]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (error) {
        await backgroundApiProxy.serviceApp.showToast({
          method: 'error',
          title: (error as Error)?.message || 'Reset SDK failed',
        });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleResetSdk = useCallback(
    async () =>
      run(async () => {
        await backgroundApiProxy.serviceHardware.resetSdkInstanceForDebug();
        await backgroundApiProxy.serviceApp.showToast({
          title: 'SDK reset completed',
        });
      }),
    [run],
  );

  if (!devSettings.enabled || platformEnv.isProduction) {
    return null;
  }

  return (
    <FloatingCard>
      <Stack gap="$2">
        <SizableText size="$bodyMdMedium">Hardware Debug</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Quick reset SDK during upgrade
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          connectId: {connectId || 'none'}
        </SizableText>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onPress={refreshDevices}
        >
          Refresh devices
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onPress={handleResetSdk}
        >
          Reset SDK
        </Button>
      </Stack>
    </FloatingCard>
  );
};

export const HardwareDebugFloatingContainer = memo(
  BaseHardwareDebugFloatingContainer,
);
