import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  ScrollView,
  Select,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HardwareCloudSyncDevicePicker } from '@onekeyhq/kit/src/views/Prime/pages/PrimeCloudSync/HardwareCloudSyncDevicePicker';
import {
  HARDWARE_PATH_TEST_MESSAGE,
  HARDWARE_PATH_TEST_PRESETS,
} from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import type {
  IHardwarePathTestMethod,
  IHardwarePathTestSignType,
} from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function HardwareDerivationPathTest() {
  const [connectId, setConnectId] = useState('');
  const [path, setPath] = useState(HARDWARE_PATH_TEST_PRESETS[0].path);
  const [method, setMethod] =
    useState<IHardwarePathTestMethod>('btcSignMessage');
  const [signType, setSignType] =
    useState<IHardwarePathTestSignType>('default');
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<string[]>([]);
  const running = useRef(false);
  const testId = useRef(`hardware-path-test-${Date.now()}`);
  const { copyText } = useClipboard();
  const appendReport = (report: unknown) => {
    setReports((previous) =>
      [JSON.stringify(report, null, 2), ...previous].slice(0, 20),
    );
  };
  useEffect(() => {
    const id = testId.current;
    return () => {
      void backgroundApiProxy.serviceDevSetting.cancelHardwareDerivationPathTest(
        id,
      );
    };
  }, []);

  const connect = () => {
    const picker = Dialog.cancel({
      title: 'Connect OneKey device',
      renderContent: (
        <HardwareCloudSyncDevicePicker
          onPick={async (selectedConnectId) => {
            setConnectId(selectedConnectId);
            await picker.close();
          }}
        />
      ),
    });
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const startedAt = Date.now();
    const request = {
      testId: testId.current,
      connectId,
      path: path.trim(),
      method,
      signType,
    };
    try {
      const result =
        await backgroundApiProxy.serviceDevSetting.testHardwareDerivationPath(
          request,
        );
      appendReport({ ...result, durationMs: Date.now() - startedAt });
    } catch (error) {
      appendReport({
        method: request.method,
        path: request.path,
        signType: request.signType,
        success: false,
        durationMs: Date.now() - startedAt,
        error: toPlainErrorObject(error),
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  if (platformEnv.isExtension) {
    return (
      <SizableText>
        Use desktop, mobile or web for direct OneKey device testing.
      </SizableText>
    );
  }

  return (
    <YStack gap="$3" testID="hardware-path-test">
      <SizableText size="$bodySm" color="$textSubdued">
        Standard wallet · Bitcoin · Device safety checks stay enabled. Each run
        makes one selected call. Confirm or reject signing on the device.
      </SizableText>
      <Button disabled={busy} onPress={connect} testID="hardware-path-search">
        Connect OneKey device
      </Button>
      <Input
        value={connectId}
        onChangeText={setConnectId}
        disabled={busy}
        placeholder="Device connectId"
        testID="hardware-path-connect-id"
      />
      <Select
        title="SDK method"
        value={method}
        disabled={busy}
        items={(
          ['btcGetPublicKey', 'btcGetAddress', 'btcSignMessage'] as const
        ).map((value) => ({ label: value, value }))}
        onChange={setMethod}
      />
      <Select
        title="Signing format"
        value={signType}
        disabled={busy || method !== 'btcSignMessage'}
        items={[
          { label: 'Default (Cloud sync / BIP137)', value: 'default' },
          { label: 'ECDSA (no script type)', value: 'ecdsa' },
          {
            label: 'BIP322 simple (Taproot / Native SegWit)',
            value: 'bip322-simple',
          },
        ]}
        onChange={setSignType}
      />
      <XStack gap="$2" flexWrap="wrap">
        {HARDWARE_PATH_TEST_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="small"
            disabled={busy}
            variant={path === preset.path ? 'primary' : 'secondary'}
            onPress={() => setPath(preset.path)}
          >
            {preset.label}
          </Button>
        ))}
      </XStack>
      <Input
        value={path}
        onChangeText={setPath}
        disabled={busy}
        placeholder="m/44'/0'/0'/0/0"
        testID="hardware-path-input"
      />
      <SizableText size="$bodySm">{HARDWARE_PATH_TEST_MESSAGE}</SizableText>
      <XStack gap="$2">
        <Button
          variant="primary"
          disabled={busy || !connectId || !path.trim()}
          onPress={run}
          testID="hardware-path-run"
        >
          Run test
        </Button>
        <Button
          disabled={!busy}
          onPress={() =>
            backgroundApiProxy.serviceDevSetting.cancelHardwareDerivationPathTest(
              testId.current,
            )
          }
        >
          Cancel test
        </Button>
      </XStack>
      <XStack gap="$2">
        <Button
          size="small"
          disabled={!reports.length}
          onPress={() => copyText(reports.join('\n\n'))}
        >
          Copy results
        </Button>
        <Button size="small" disabled={busy} onPress={() => setReports([])}>
          Clear results
        </Button>
      </XStack>
      <ScrollView maxHeight={300}>
        <SizableText size="$bodySm" selectable testID="hardware-path-results">
          {reports.join('\n\n') ||
            'Results appear here. Signatures and wallet addresses are omitted.'}
        </SizableText>
      </ScrollView>
    </YStack>
  );
}
