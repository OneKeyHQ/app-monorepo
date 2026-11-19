import { useCallback, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  SizableText,
  TextAreaInput,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HardwareCloudSyncDevicePicker } from '@onekeyhq/kit/src/views/Prime/pages/PrimeCloudSync/HardwareCloudSyncDevicePicker';
import type { IHardwareCipherKeyValueTestResult } from '@onekeyhq/kit-bg/src/services/hardwareCipherKeyValueTest';

const DEFAULT_KEY =
  'OneKey CipherKeyValue DEV TEST. Confirm only in the OneKey App.';

export function CipherKeyValueDevSettings() {
  const [key, setKey] = useState(DEFAULT_KEY);
  const [connectId, setConnectId] = useState<string>();
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [result, setResult] = useState<IHardwareCipherKeyValueTestResult>();
  const [error, setError] = useState<string>();
  const selectDevice = useCallback(() => {
    const picker = Dialog.show({
      title: 'Select a OneKey device',
      showConfirmButton: false,
      onClose: async () => {
        await backgroundApiProxy.serviceHardware.clearForceTransportType();
      },
      renderContent: (
        <HardwareCloudSyncDevicePicker
          onPick={async (id) => {
            setConnectId(id);
            setResult(undefined);
            setError(undefined);
            await picker.close();
          }}
        />
      ),
    });
  }, []);
  const run = useCallback(async () => {
    if (!connectId || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setResult(undefined);
    setError(undefined);
    try {
      const next =
        await backgroundApiProxy.serviceDevSetting.testHardwareCipherKeyValue({
          connectId,
          key,
        });
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CipherKeyValue test failed.');
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [connectId, key]);

  return (
    <YStack gap="$4" testID="cipher-key-value-panel">
      <SizableText size="$bodyMd">
        Connect a real OneKey device. This test encrypts the same public value
        twice, then decrypts it. Confirm all 3 requests on the device.
      </SizableText>
      <Button
        testID="cipher-key-value-select-device"
        onPress={selectDevice}
        disabled={running}
      >
        {connectId ? 'Change device' : 'Select device'}
      </Button>
      <SizableText size="$bodySm" color="$textSubdued">
        {connectId ? 'Device selected' : ''}
        {"\nPath: m/10016'/0' · Value: 000102030405060708090a0b0c0d0e0f"}
        {'\naskOnEncrypt = true · askOnDecrypt = true · default IV'}
      </SizableText>
      <SizableText size="$bodyMdMedium">Key text shown on device</SizableText>
      <TextAreaInput
        testID="cipher-key-value-key"
        value={key}
        onChangeText={(text) => {
          setKey(text);
          setResult(undefined);
          setError(undefined);
        }}
        maxLength={512}
        disabled={running}
      />
      <Button
        testID="cipher-key-value-run"
        variant="primary"
        onPress={run}
        loading={running}
        disabled={!connectId || !key.trim() || running}
      >
        {running ? 'Confirm on your device…' : 'Run CipherKeyValue test'}
      </Button>
      {error ? (
        <SizableText testID="cipher-key-value-error" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      {result ? (
        <YStack gap="$2" testID="cipher-key-value-result">
          <SizableText
            size="$bodyLgMedium"
            color={
              result.deterministic && result.roundTrip
                ? '$textSuccess'
                : '$textCritical'
            }
          >
            {result.deterministic && result.roundTrip ? 'PASS' : 'FAIL'}
          </SizableText>
          <SizableText size="$bodyMd">
            {`${result.deviceType} · firmware ${result.firmwareVersion}\nRepeated encryption: ${result.deterministic ? 'same' : 'different'}\nDecrypt matches input: ${result.roundTrip ? 'yes' : 'no'}\nOutput: ${result.outputBytes} bytes\nEncrypt #1: ${result.encryptFirstMs} ms\nEncrypt #2: ${result.encryptSecondMs} ms\nDecrypt: ${result.decryptMs} ms`}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}
