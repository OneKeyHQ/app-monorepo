import { useEffect, useRef, useState } from 'react';

import { Alert, Button, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Development-only acceptance entry until real model/firmware pairs are certified.
export function HardwareCloudSyncKeySection() {
  const [config] = usePrimeCloudSyncPersistAtom();
  const [pending, setPending] = useState(false);
  const [requiresHardware, setRequiresHardware] = useState(false);
  const source = config.hardwareCloudSyncKeySource;
  const sourceIdRef = useRef(source?.credentialId);
  sourceIdRef.current = source?.credentialId;
  const { result: wallets = [] } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceKeylessCloudSync.getHardwareCloudSyncCandidates(),
    [],
  );
  useEffect(
    () => () => {
      void backgroundApiProxy.serviceKeylessCloudSync.cancelHardwareCloudKeyOperation();
    },
    [],
  );

  useEffect(() => {
    setRequiresHardware(false);
  }, [source?.credentialId]);

  if (!platformEnv.isDev && !source) return null;
  return (
    <Stack p="$5" gap="$3">
      <SizableText size="$headingMd">Cloud key</SizableText>
      <Alert
        type="warning"
        title="Hardware validation build"
        description="This signature unlocks all synced wallet data. Confirm only when enabling Cloud in this App. Never sign it in a dApp. Device compatibility is not yet certified."
      />
      {source ? (
        <>
          <SizableText>Standard hardware wallet selected</SizableText>
          {platformEnv.isDev && !config.isCloudSyncEnabledKeyless ? (
            <Button
              testID="cloud-hardware-key-resume"
              disabled={pending}
              loading={pending}
              onPress={async () => {
                setPending(true);
                setRequiresHardware(false);
                try {
                  const result =
                    await backgroundApiProxy.serviceKeylessCloudSync.toggleCloudSyncKeyless(
                      {
                        enabled: true,
                        expectedHardwareCloudKeySourceId: source.credentialId,
                      },
                    );
                  if (sourceIdRef.current === source.credentialId) {
                    setRequiresHardware(
                      !!result && result.requiresHardware === true,
                    );
                  }
                } finally {
                  setPending(false);
                }
              }}
            >
              Resume sync
            </Button>
          ) : null}
          {requiresHardware ? (
            <Alert
              type="warning"
              title="Cloud key unavailable"
              description="Connect your standard hardware wallet and select it below to restore the Cloud key."
            />
          ) : null}
          <Button
            testID="cloud-hardware-key-sync-now"
            disabled={pending || !config.isCloudSyncEnabledKeyless}
            onPress={async () => {
              setPending(true);
              try {
                await backgroundApiProxy.servicePrimeCloudSync.syncNowKeyless({
                  callerName: 'Manual hardware Cloud sync',
                  noDebounceUpload: true,
                  forceSync: true,
                });
              } finally {
                setPending(false);
              }
            }}
          >
            Sync now
          </Button>
          <Button
            testID="cloud-hardware-key-disable"
            disabled={pending || !config.isCloudSyncEnabledKeyless}
            onPress={async () => {
              await backgroundApiProxy.serviceKeylessCloudSync.toggleCloudSyncKeyless(
                { enabled: false },
              );
            }}
          >
            Turn off sync
          </Button>
          <Button
            testID="cloud-hardware-key-select-keyless"
            disabled={pending || !!config.isCloudSyncEnabledKeyless}
            onPress={async () => {
              setPending(true);
              try {
                await backgroundApiProxy.serviceKeylessCloudSync.selectKeylessCloudSyncKey();
              } finally {
                setPending(false);
              }
            }}
          >
            Select Keyless
          </Button>
        </>
      ) : null}
      {platformEnv.isDev
        ? wallets.map((wallet) => (
            <Button
              testID={`cloud-hardware-key-enable-${wallet.id}`}
              key={wallet.id}
              disabled={
                pending ||
                !!config.isCloudSyncEnabled ||
                !!config.isCloudSyncEnabledKeyless
              }
              loading={pending}
              onPress={async () => {
                setPending(true);
                try {
                  await backgroundApiProxy.serviceKeylessCloudSync.enableHardwareCloudSync(
                    { walletId: wallet.id },
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              Use {wallet.name}
            </Button>
          ))
        : null}
      {pending ? (
        <Button
          testID="cloud-hardware-key-cancel"
          variant="tertiary"
          onPress={async () =>
            backgroundApiProxy.serviceKeylessCloudSync.cancelHardwareCloudKeyOperation()
          }
        >
          Cancel
        </Button>
      ) : null}
      <SizableText size="$bodySm" color="$textSubdued">
        Start with a profile without existing Cloud data. Changing an existing
        space's key is blocked; no migration or deletion runs.
      </SizableText>
    </Stack>
  );
}
