import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  Page,
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
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export function HardwareDerivationPathTest({
  asPage = false,
}: {
  asPage?: boolean;
}) {
  const intl = useIntl();
  const [connectId, setConnectId] = useState('');
  const [path, setPath] = useState(HARDWARE_PATH_TEST_PRESETS[0].path);
  const [method, setMethod] =
    useState<IHardwarePathTestMethod>('btcSignMessage');
  const [signType, setSignType] =
    useState<IHardwarePathTestSignType>('default');
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<string[]>([]);
  const running = useRef(false);
  const testId = useRef(generateUUID());
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
      title: intl.formatMessage({
        id: ETranslations.device_stage_connect_device__title,
      }),
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
      const failure = error as IOneKeyError | undefined;
      appendReport({
        method: request.method,
        path: request.path,
        signType: request.signType,
        success: false,
        durationMs: Date.now() - startedAt,
        error: {
          key: failure?.key,
          code: failure?.code,
          message: failure?.message,
        },
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const title = intl.formatMessage({ id: ETranslations.dev_hw_path__title });
  const results = (
    <SizableText size="$bodySm" selectable testID="hardware-path-results">
      {reports.join('\n\n') ||
        intl.formatMessage({ id: ETranslations.dev_hw_path_results__msg })}
    </SizableText>
  );
  const actions = (
    <YStack gap="$2" testID="hardware-path-actions">
      <XStack gap="$2">
        <Button
          variant="primary"
          disabled={busy || !connectId || !path.trim()}
          onPress={run}
          testID="hardware-path-run"
        >
          {intl.formatMessage({ id: ETranslations.global_test })}
        </Button>
        <Button
          disabled={!busy}
          onPress={() =>
            backgroundApiProxy.serviceDevSetting.cancelHardwareDerivationPathTest(
              testId.current,
            )
          }
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
      </XStack>
      <XStack gap="$2">
        <Button
          size="small"
          disabled={!reports.length}
          onPress={() => copyText(reports.join('\n\n'))}
        >
          {intl.formatMessage({ id: ETranslations.global_copy })}
        </Button>
        <Button size="small" disabled={busy} onPress={() => setReports([])}>
          {intl.formatMessage({ id: ETranslations.global_clear })}
        </Button>
      </XStack>
    </YStack>
  );

  if (platformEnv.isExtension) {
    const unsupported = (
      <SizableText>
        {intl.formatMessage({ id: ETranslations.dev_hw_path_platform__msg })}
      </SizableText>
    );
    return asPage ? (
      <Page>
        <Page.Header title={title} />
        <Page.Body px="$5" py="$4">
          {unsupported}
        </Page.Body>
      </Page>
    ) : (
      unsupported
    );
  }

  const form = (
    <YStack gap="$3" testID="hardware-path-test">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.dev_hw_path_instructions__desc,
        })}
      </SizableText>
      <Button disabled={busy} onPress={connect} testID="hardware-path-search">
        {intl.formatMessage({
          id: ETranslations.device_stage_connect_device__title,
        })}
      </Button>
      <SizableText>
        {intl.formatMessage({
          id: ETranslations.dev_hw_path_connection__title,
        })}
      </SizableText>
      <Input
        value={connectId}
        onChangeText={setConnectId}
        disabled={busy}
        testID="hardware-path-connect-id"
      />
      <Select
        title={intl.formatMessage({
          id: ETranslations.dev_hw_path_method__title,
        })}
        value={method}
        disabled={busy}
        items={(
          ['btcGetPublicKey', 'btcGetAddress', 'btcSignMessage'] as const
        ).map((value) => ({ label: value, value }))}
        onChange={setMethod}
      />
      <Select
        title={intl.formatMessage({
          id: ETranslations.dev_hw_path_format__title,
        })}
        value={signType}
        disabled={busy || method !== 'btcSignMessage'}
        items={[
          {
            label: `${intl.formatMessage({ id: ETranslations.global_default })} (BIP137)`,
            value: 'default',
          },
          { label: 'ECDSA', value: 'ecdsa' },
          {
            label: 'BIP322 simple (P2TR / P2WPKH)',
            value: 'bip322-simple',
          },
        ]}
        onChange={setSignType}
      />
      <XStack gap="$2" flexWrap="wrap">
        {HARDWARE_PATH_TEST_PRESETS.map((preset, index) => {
          const button = (
            <Button
              key={preset.path}
              size="small"
              disabled={busy}
              variant={path === preset.path ? 'primary' : 'secondary'}
              onPress={() => setPath(preset.path)}
              testID={`hardware-path-preset-${index}`}
            >
              {'labelKey' in preset
                ? intl.formatMessage({ id: preset.labelKey }, preset.values)
                : preset.label}
            </Button>
          );
          return index < 2 ? (
            <YStack key={preset.path} gap="$1" width="100%">
              {button}
              <SizableText
                size="$bodySm"
                selectable
                testID={`hardware-path-default-${index}`}
              >
                {preset.path}
              </SizableText>
            </YStack>
          ) : (
            button
          );
        })}
      </XStack>
      <SizableText>
        {intl.formatMessage({ id: ETranslations.global_derivation_path })}
      </SizableText>
      <Input
        value={path}
        onChangeText={setPath}
        disabled={busy}
        placeholder="m/44'/0'/0'/0/0"
        testID="hardware-path-input"
      />
      <SizableText size="$bodySm">{HARDWARE_PATH_TEST_MESSAGE}</SizableText>
      {asPage ? results : <ScrollView maxHeight={300}>{results}</ScrollView>}
    </YStack>
  );

  return asPage ? (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body px="$5" py="$4">
        {form}
      </Page.Body>
      <Page.Footer>
        <YStack px="$5" py="$3" bg="$bgApp">
          {actions}
        </YStack>
      </Page.Footer>
    </Page>
  ) : (
    <YStack gap="$3">
      {form}
      {actions}
    </YStack>
  );
}

export default function HardwareDerivationPathTestPage() {
  return <HardwareDerivationPathTest asPage />;
}
