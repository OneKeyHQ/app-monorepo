import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ITransportState = 'idle' | 'starting' | 'ready' | 'remote-broken';

type ITransportGlobal = typeof globalThis & {
  __onekeyNativeBackgroundThreadTransport?: {
    getState: () => ITransportState;
    isEnabled: () => boolean;
  };
  __onekeyBackgroundThreadReadyPayload?: {
    runtime: string;
    status: string;
    protocolVersion: string;
    bootId: string;
    ts: number;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTransportInfo() {
  const g = globalThis as ITransportGlobal;
  const transport = g.__onekeyNativeBackgroundThreadTransport;
  return {
    state: transport?.getState() ?? 'N/A',
    enabled: transport?.isEnabled() ?? false,
    readyPayload: g.__onekeyBackgroundThreadReadyPayload,
  };
}

function StatusCard({
  ok,
  label,
  detail,
  large,
}: {
  ok: boolean | null;
  label: string;
  detail?: string;
  large?: boolean;
}) {
  let bg: string;
  let fg: string;
  if (ok === null) {
    bg = '$bgInfoSubdued';
    fg = '$textInfo';
  } else if (ok) {
    bg = '$bgSuccessSubdued';
    fg = '$textSuccess';
  } else {
    bg = '$bgCriticalSubdued';
    fg = '$textCritical';
  }
  return (
    <YStack
      px="$3"
      py={large ? '$4' : '$2'}
      bg={bg}
      borderRadius="$3"
      gap="$1"
      flex={large ? 1 : undefined}
    >
      <SizableText size={large ? '$headingMd' : '$bodyMdMedium'} color={fg}>
        {label}
      </SizableText>
      {detail ? (
        <SizableText size="$bodySm" color={fg}>
          {detail}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" py="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" flexShrink={1} textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

// ---------------------------------------------------------------------------
// Runtime Mode Section
// ---------------------------------------------------------------------------

function RuntimeModeSection() {
  const isDualThread = platformEnv.enableNativeBackgroundThread === true;

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">Thread Mode</SizableText>
      <XStack gap="$2">
        <StatusCard
          large
          ok={isDualThread}
          label={isDualThread ? 'Dual Thread' : 'Single Thread'}
          detail={
            isDualThread
              ? 'Background service runs on a separate JS thread'
              : 'All code runs on the main JS thread'
          }
        />
      </XStack>
      <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2">
        <InfoRow
          label="enableNativeBackgroundThread"
          value={String(
            platformEnv.enableNativeBackgroundThread ?? 'undefined',
          )}
        />
        <InfoRow
          label="isNativeMainThread"
          value={String(platformEnv.isNativeMainThread ?? 'undefined')}
        />
        <InfoRow
          label="isNativeBackgroundThread"
          value={String(platformEnv.isNativeBackgroundThread ?? 'undefined')}
        />
        <InfoRow
          label="isNative"
          value={String(platformEnv.isNative ?? false)}
        />
      </YStack>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Transport State Section
// ---------------------------------------------------------------------------

function TransportStateSection() {
  const [info, setInfo] = useState(getTransportInfo);

  const refresh = useCallback(() => {
    setInfo(getTransportInfo());
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  let stateOk: boolean | null;
  if (info.state === 'ready') {
    stateOk = true;
  } else if (info.state === 'remote-broken') {
    stateOk = false;
  } else {
    stateOk = null;
  }

  function getStateDetail() {
    switch (info.state) {
      case 'ready':
        return 'RPC channel active';
      case 'remote-broken':
        return 'Remote channel broken';
      case 'starting':
        return 'Waiting for background thread...';
      default:
        return 'Transport not initialized';
    }
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$headingSm">Transport State</SizableText>
        <Button size="small" variant="tertiary" onPress={refresh}>
          Refresh
        </Button>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <StatusCard
          ok={stateOk}
          label={`State: ${info.state}`}
          detail={getStateDetail()}
        />
        <StatusCard
          ok={info.enabled}
          label={info.enabled ? 'Transport Enabled' : 'Transport Disabled'}
        />
      </XStack>
      {info.readyPayload ? (
        <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2">
          <InfoRow label="bootId" value={info.readyPayload.bootId} />
          <InfoRow
            label="ready at"
            value={new Date(info.readyPayload.ts).toLocaleTimeString()}
          />
          <InfoRow
            label="protocolVersion"
            value={info.readyPayload.protocolVersion}
          />
        </YStack>
      ) : (
        <StatusCard
          ok={null}
          label="No Ready Payload"
          detail="Background thread has not signaled ready"
        />
      )}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Service Communication Test
// ---------------------------------------------------------------------------

type ITestResult = {
  name: string;
  ok: boolean;
  detail: string;
  durationMs: number;
};

function ServiceTestSection() {
  const [results, setResults] = useState<ITestResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const tests: ITestResult[] = [];

    // Test 1: serviceSetting — lightweight
    try {
      const start = Date.now();
      const theme = await backgroundApiProxy.serviceSetting.getInstanceId();
      tests.push({
        name: 'serviceSetting.getInstanceId',
        ok: true,
        detail: `id=${typeof theme === 'string' ? theme.slice(0, 8) : String(theme)}...`,
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'serviceSetting.getInstanceId',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    // Test 2: serviceNetwork — medium payload
    try {
      const start = Date.now();
      const resp = await backgroundApiProxy.serviceNetwork.getAllNetworks({
        excludeAllNetworkItem: true,
      });
      tests.push({
        name: 'serviceNetwork.getAllNetworks',
        ok: true,
        detail: `${resp?.networks?.length ?? 0} networks`,
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'serviceNetwork.getAllNetworks',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    // Test 3: serviceAccount — DB access
    try {
      const start = Date.now();
      const resp = await backgroundApiProxy.serviceAccount.getAllAccounts({
        filterRemoved: true,
      });
      tests.push({
        name: 'serviceAccount.getAllAccounts',
        ok: true,
        detail: `${resp?.accounts?.length ?? 0} accounts`,
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'serviceAccount.getAllAccounts',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    // Test 4: serviceDemo — demo service
    try {
      const start = Date.now();
      const resp = await backgroundApiProxy.serviceDemo.demoGetAllRecords();
      tests.push({
        name: 'serviceDemo.demoGetAllRecords',
        ok: true,
        detail: `${resp?.length ?? 0} records`,
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'serviceDemo.demoGetAllRecords',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    // Test 5: simpleDb read
    try {
      const start = Date.now();
      const data =
        await backgroundApiProxy.simpleDb.accountSelector.getRawData();
      tests.push({
        name: 'simpleDb.accountSelector.getRawData',
        ok: true,
        detail: data ? 'has data' : 'empty',
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'simpleDb.accountSelector.getRawData',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    setResults(tests);
    setRunning(false);
  }, []);

  // Concurrent test
  const [concurrentResult, setConcurrentResult] = useState<string | null>(null);
  const runConcurrentTest = useCallback(async () => {
    setRunning(true);
    setConcurrentResult(null);
    try {
      const start = Date.now();
      const promises = Array.from({ length: 5 }, () =>
        backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeAllNetworkItem: true,
        }),
      );
      const concurrentResults = await Promise.all(promises);
      const elapsed = Date.now() - start;
      const allOk = concurrentResults.every(
        (r) => (r?.networks?.length ?? 0) > 0,
      );
      setConcurrentResult(
        allOk
          ? `5 concurrent calls OK in ${elapsed}ms (avg ${Math.round(elapsed / 5)}ms)`
          : `Some calls returned empty results`,
      );
    } catch (e: any) {
      setConcurrentResult(`Failed: ${e?.message ?? String(e)}`);
    }
    setRunning(false);
  }, []);

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">Service Communication</SizableText>

      <XStack gap="$2">
        <Button
          size="small"
          onPress={runTests}
          loading={running}
          disabled={running}
        >
          Run Tests
        </Button>
        <Button
          size="small"
          variant="secondary"
          onPress={runConcurrentTest}
          loading={running}
          disabled={running}
        >
          Concurrent Test
        </Button>
      </XStack>

      {results.length > 0 ? (
        <YStack gap="$1.5">
          {results.map((r) => (
            <StatusCard
              key={r.name}
              ok={r.ok}
              label={`${r.name} (${r.durationMs}ms)`}
              detail={r.detail}
            />
          ))}
          <StatusCard
            ok={passed === total}
            label={`${passed}/${total} passed`}
            detail={`avg ${Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total)}ms`}
          />
        </YStack>
      ) : null}

      {concurrentResult ? (
        <StatusCard
          ok={concurrentResult.startsWith('5')}
          label="Concurrent Test"
          detail={concurrentResult}
        />
      ) : null}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function DevSplitBundleTest() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Split Bundle & Background Thread" />
      <Page.Body>
        <Stack px="$5" py="$4" gap="$6">
          <RuntimeModeSection />
          <TransportStateSection />
          <ServiceTestSection />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default DevSplitBundleTest;
