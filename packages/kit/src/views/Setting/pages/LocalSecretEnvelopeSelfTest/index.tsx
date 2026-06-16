import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  ILocalSecretEnvelopeE2ECheckpoint,
  ILocalSecretEnvelopeE2ETestReport,
} from '@onekeyhq/kit-bg/src/services/ServiceE2E';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';
import { showDevOnlyPasswordDialog } from '../Tab/DevSettingsSection';

const STATUS_EMOJI: Record<
  ILocalSecretEnvelopeE2ECheckpoint['status'],
  string
> = {
  failed: '❌',
  passed: '✅',
  skipped: '⏭️',
};

export default function LocalSecretEnvelopeSelfTest() {
  const route = useAppRoute<
    IModalSettingParamList,
    EModalSettingRoutes.SettingDevLocalSecretEnvelopeSelfTestModal
  >();
  const testKind = route.params?.testKind ?? 'debug';
  const isRestore = testKind === 'restore';
  const title = isRestore ? 'LSE Restore Self-Test' : 'LSE Self-Test';

  const { copyText } = useClipboard();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<
    ILocalSecretEnvelopeE2ETestReport | undefined
  >();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const runTest = useCallback(
    async (params: IBackgroundMethodWithDevOnlyPassword) => {
      setIsRunning(true);
      setErrorMessage(undefined);
      try {
        const result = isRestore
          ? await backgroundApiProxy.serviceE2E.runLocalSecretEnvelopeRestoreSelfTest(
              params,
            )
          : await backgroundApiProxy.serviceE2E.runLocalSecretEnvelopeDebugSelfTest(
              params,
            );
        setReport(result);
      } catch (error) {
        setReport(undefined);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsRunning(false);
      }
    },
    [isRestore],
  );

  const handleRun = useCallback(() => {
    showDevOnlyPasswordDialog({
      title,
      description: isRestore
        ? 'Creates a temporary imported credential LSE record, verifies local read, Cloud Backup export, and Prime Transfer export guards, then cleans up test data.'
        : 'Creates temporary LSE records and keys, verifies unwrap and key deletion behavior, then cleans up test data.',
      confirmButtonProps: {
        testID: isRestore
          ? SettingTestIDs.localSecretEnvelopeRestoreSelfTestConfirm
          : SettingTestIDs.localSecretEnvelopeSelfTestConfirm,
        variant: 'primary',
      },
      onConfirm: async (params) => {
        await runTest(params);
      },
    });
  }, [isRestore, runTest, title]);

  const groups = useMemo(() => {
    if (!report) {
      return [] as {
        group: string;
        items: ILocalSecretEnvelopeE2ECheckpoint[];
      }[];
    }
    const order: string[] = [];
    const map = new Map<string, ILocalSecretEnvelopeE2ECheckpoint[]>();
    for (const checkpoint of report.checkpoints) {
      const existed = map.get(checkpoint.group);
      if (existed) {
        existed.push(checkpoint);
      } else {
        map.set(checkpoint.group, [checkpoint]);
        order.push(checkpoint.group);
      }
    }
    return order.map((group) => ({ group, items: map.get(group) ?? [] }));
  }, [report]);

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <YStack gap="$4" px="$5" py="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          {isRestore
            ? 'Non-destructive verification of restore/export guards for Cloud Backup and Prime Transfer. Runs against the current platform configuration.'
            : 'Non-destructive verification of LSE wrap/unwrap and per-layer key-deletion guards. Runs against the current platform configuration.'}
        </SizableText>

        <Button
          variant="primary"
          loading={isRunning}
          disabled={isRunning}
          onPress={handleRun}
          testID={
            isRestore
              ? SettingTestIDs.localSecretEnvelopeRestoreSelfTestButton
              : SettingTestIDs.localSecretEnvelopeSelfTestButton
          }
        >
          {report || errorMessage ? 'Re-run test' : 'Run test'}
        </Button>

        {errorMessage ? (
          <YStack gap="$1" p="$3" bg="$bgCritical" borderRadius="$3">
            <SizableText size="$headingSm" color="$textCritical">
              ❌ Test crashed before completing
            </SizableText>
            <SizableText size="$bodyMd" color="$textCritical">
              {errorMessage}
            </SizableText>
          </YStack>
        ) : null}

        {report ? (
          <>
            <YStack gap="$2" p="$3" bg="$bgSubdued" borderRadius="$3">
              <XStack alignItems="center" gap="$2">
                <SizableText size="$headingMd">
                  {report.passed ? '✅' : '❌'}
                </SizableText>
                <SizableText size="$headingMd">
                  {report.passed ? 'All checks passed' : 'Some checks failed'}
                </SizableText>
              </XStack>
              <SizableText size="$bodyMd" color="$textSubdued">
                {`✅ ${report.passedCount} passed  ·  ❌ ${report.failedCount} failed  ·  ⏭️ ${report.skippedCount} skipped`}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {`Platform: ${report.runtimePlatform}`}
              </SizableText>
            </YStack>

            {groups.map(({ group, items }) => (
              <YStack key={group} gap="$2">
                <SizableText size="$headingSm" color="$textSubdued">
                  {group}
                </SizableText>
                {items.map((checkpoint, index) => (
                  <XStack
                    key={`${group}-${index}`}
                    gap="$2"
                    alignItems="flex-start"
                  >
                    <SizableText size="$bodyLg">
                      {STATUS_EMOJI[checkpoint.status]}
                    </SizableText>
                    <YStack flex={1} gap="$1">
                      <SizableText size="$bodyMd">
                        {checkpoint.label}
                      </SizableText>
                      {checkpoint.detail && checkpoint.status !== 'passed' ? (
                        <SizableText
                          size="$bodySm"
                          color={
                            checkpoint.status === 'failed'
                              ? '$textCritical'
                              : '$textSubdued'
                          }
                        >
                          {checkpoint.detail}
                        </SizableText>
                      ) : null}
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            ))}

            <Button
              variant="secondary"
              testID={SettingTestIDs.localSecretEnvelopeSelfTestCopyRaw}
              onPress={() => copyText(JSON.stringify(report, null, 2))}
            >
              Copy raw JSON
            </Button>
          </>
        ) : null}
      </YStack>
    </Page>
  );
}
