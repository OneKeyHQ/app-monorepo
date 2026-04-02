import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail?: string;
}) {
  const bg = ok === null ? '$bgInfo' : ok ? '$bgSuccess' : '$bgCritical';
  const fg = ok === null ? '$textInfo' : ok ? '$textSuccess' : '$textCritical';
  return (
    <YStack
      px="$3"
      py="$2"
      bg={bg}
      borderRadius="$2"
      gap="$0.5"
    >
      <SizableText size="$bodyMdMedium" color={fg}>
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

// ---------------------------------------------------------------------------
// Runtime Info Section
// ---------------------------------------------------------------------------

function RuntimeInfoSection() {
  return (
    <YStack gap="$2">
      <SizableText size="$headingSm">Runtime Info</SizableText>
      <XStack flexWrap="wrap" gap="$2">
        <StatusBadge
          ok={platformEnv.enableNativeBackgroundThread ?? false}
          label="Background Thread"
          detail={
            platformEnv.enableNativeBackgroundThread
              ? 'Enabled (dual runtime)'
              : 'Disabled (single thread)'
          }
        />
        <StatusBadge
          ok={platformEnv.isNativeMainThread ?? false}
          label="Current Runtime"
          detail={
            platformEnv.isNativeMainThread ? 'Main Thread' : 'Unknown'
          }
        />
        <StatusBadge
          ok={platformEnv.isNative ?? false}
          label="Platform"
          detail={platformEnv.isNative ? 'Native' : 'Non-native'}
        />
      </XStack>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Segment Stats Section
// ---------------------------------------------------------------------------

function SegmentStatsSection() {
  const [stats, setStats] = useState<{
    totalLoaded: number;
    totalTimeMs: number;
    failures: number;
  } | null>(null);
  const [manifestCount, setManifestCount] = useState<number | null>(null);

  const refresh = useCallback(() => {
    try {
      // Dynamic require to avoid pulling split bundle infra into non-native
      if (platformEnv.isNative && !__DEV__) {
        const { getSegmentLoadStats } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../../../splitBundle/installProdBundleLoader') as typeof import('../../../../splitBundle/installProdBundleLoader');
        setStats(getSegmentLoadStats());

        const { getSegmentManifest } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../../../splitBundle/segmentManifest') as typeof import('../../../../splitBundle/segmentManifest');
        const manifest = getSegmentManifest();
        setManifestCount(Object.keys(manifest.segments).length);
      }
    } catch {
      // Not in split bundle mode
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (__DEV__) {
    return (
      <YStack gap="$2">
        <SizableText size="$headingSm">Segment Stats</SizableText>
        <StatusBadge ok={null} label="Dev Mode" detail="Segments disabled in dev" />
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$headingSm">Segment Stats</SizableText>
        <Button size="small" onPress={refresh}>
          Refresh
        </Button>
      </XStack>
      {stats ? (
        <XStack flexWrap="wrap" gap="$2">
          <StatusBadge
            ok={null}
            label="Manifest"
            detail={`${manifestCount ?? '?'} segments`}
          />
          <StatusBadge
            ok={stats.totalLoaded > 0}
            label="Loaded"
            detail={`${stats.totalLoaded} segments`}
          />
          <StatusBadge
            ok={null}
            label="Total Time"
            detail={`${stats.totalTimeMs.toFixed(0)}ms`}
          />
          <StatusBadge
            ok={stats.failures === 0}
            label="Failures"
            detail={`${stats.failures}`}
          />
        </XStack>
      ) : (
        <StatusBadge ok={null} label="No Data" detail="Segment loader not initialized" />
      )}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Service Communication Test Section
// ---------------------------------------------------------------------------

type IServiceTestResult = {
  name: string;
  ok: boolean;
  detail: string;
  durationMs: number;
};

function ServiceTestSection() {
  const [results, setResults] = useState<IServiceTestResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const tests: IServiceTestResult[] = [];

    // Test 1: serviceSetting.getTheme — lightweight RPC
    try {
      const start = Date.now();
      const settings = await backgroundApiProxy.serviceSetting.getTheme();
      tests.push({
        name: 'serviceSetting.getTheme',
        ok: true,
        detail: `theme=${settings}`,
        durationMs: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        name: 'serviceSetting.getTheme',
        ok: false,
        detail: e?.message ?? String(e),
        durationMs: 0,
      });
    }

    // Test 2: serviceNetwork.getPresetNetworks — medium RPC
    try {
      const start = Date.now();
      const resp =
        await backgroundApiProxy.serviceNetwork.getAllNetworks({
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

    // Test 3: serviceAccount.getAllAccounts — DB access RPC
    try {
      const start = Date.now();
      const resp = await backgroundApiProxy.serviceAccount.getAllAccounts({
        filterRemoved: true,
      });
      tests.push({
        name: 'serviceAccount.getAllAccounts',
        ok: true,
        detail: `${resp?.length ?? 0} accounts`,
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

    // Test 4: serviceDemo.demoGetAllRecords — demo service
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

    // Test 5: simpleDb read — direct DB proxy
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

  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$headingSm">Service Communication</SizableText>
        <Button
          size="small"
          onPress={runTests}
          loading={running}
          disabled={running}
        >
          Run Tests
        </Button>
      </XStack>
      {results.length > 0 ? (
        <YStack gap="$1.5">
          {results.map((r) => (
            <StatusBadge
              key={r.name}
              ok={r.ok}
              label={`${r.name} (${r.durationMs}ms)`}
              detail={r.detail}
            />
          ))}
          <StatusBadge
            ok={results.every((r) => r.ok)}
            label={`${results.filter((r) => r.ok).length}/${results.length} passed`}
            detail={`avg ${(results.reduce((s, r) => s + r.durationMs, 0) / results.length).toFixed(0)}ms`}
          />
        </YStack>
      ) : (
        <StatusBadge
          ok={null}
          label="Not tested yet"
          detail="Press Run Tests"
        />
      )}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Main Gallery Page
// ---------------------------------------------------------------------------

const SplitBundleGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="SplitBundle & Background Thread"
    description="Check runtime mode, segment loading stats, and test background service communication."
    elements={[
      {
        title: 'Runtime Mode',
        element: <RuntimeInfoSection />,
      },
      {
        title: 'Segment Loading',
        element: <SegmentStatsSection />,
      },
      {
        title: 'Background Service RPC',
        element: <ServiceTestSection />,
      },
    ]}
  />
);

export default SplitBundleGallery;
