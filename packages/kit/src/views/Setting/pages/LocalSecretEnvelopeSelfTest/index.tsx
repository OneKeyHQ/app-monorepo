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
import { showDevOnlyPasswordDialog } from '../Tab/DevSettingsSection/showDevOnlyPasswordDialog';

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
  const isDiagnostic = testKind === 'diagnostic';
  let title = 'LSE Self-Test';
  if (isRestore) {
    title = 'LSE Restore Self-Test';
  } else if (isDiagnostic) {
    title = 'LSE Migration Diagnostic';
  }

  let pageDescription =
    'Non-destructive verification of LSE wrap/unwrap and per-layer key-deletion guards. Runs against the current platform configuration.';
  if (isRestore) {
    pageDescription =
      'Non-destructive verification of restore/export guards for Cloud Backup and Prime Transfer. Runs against the current platform configuration.';
  } else if (isDiagnostic) {
    pageDescription =
      'Read-only scan of existing credentials and the verify-string. Reports the encryption method and KDF iterations per record, tagged confirmed (exact) or inferred (default). For LSE records it peels only the device layer (never the password) to read the exact inner iterations. It never decrypts the secret or exposes ciphertext / plaintext. Runs against the current platform configuration.';
  }

  let runButtonTestID: string =
    SettingTestIDs.localSecretEnvelopeSelfTestButton;
  if (isRestore) {
    runButtonTestID = SettingTestIDs.localSecretEnvelopeRestoreSelfTestButton;
  } else if (isDiagnostic) {
    runButtonTestID =
      SettingTestIDs.localSecretEnvelopeMigrationDiagnosticButton;
  }

  const getSummaryHeading = (passed: boolean) => {
    if (isDiagnostic) {
      return passed
        ? 'No legacy / low-KDF records found'
        : 'Found records needing upgrade';
    }
    return passed ? 'All checks passed' : 'Some checks failed';
  };

  const { copyText } = useClipboard();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<
    ILocalSecretEnvelopeE2ETestReport | undefined
  >();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const hasResult = Boolean(report || errorMessage);
  let runButtonLabel = hasResult ? 'Re-run test' : 'Run test';
  if (isDiagnostic) {
    runButtonLabel = hasResult ? 'Re-scan' : 'Run scan';
  }

  const runTest = useCallback(
    async (params: IBackgroundMethodWithDevOnlyPassword) => {
      setIsRunning(true);
      setErrorMessage(undefined);
      try {
        let result: ILocalSecretEnvelopeE2ETestReport;
        if (isDiagnostic) {
          result =
            await backgroundApiProxy.serviceE2E.runLocalSecretEnvelopeMigrationDiagnostic(
              params,
            );
        } else if (isRestore) {
          result =
            await backgroundApiProxy.serviceE2E.runLocalSecretEnvelopeRestoreSelfTest(
              params,
            );
        } else {
          result =
            await backgroundApiProxy.serviceE2E.runLocalSecretEnvelopeDebugSelfTest(
              params,
            );
        }
        setReport(result);
      } catch (error) {
        setReport(undefined);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsRunning(false);
      }
    },
    [isDiagnostic, isRestore],
  );

  const handleRun = useCallback(() => {
    let description =
      'Creates temporary LSE records and keys, verifies unwrap and key deletion behavior, then cleans up test data.';
    let confirmTestID: string =
      SettingTestIDs.localSecretEnvelopeSelfTestConfirm;
    if (isRestore) {
      description =
        'Creates a temporary imported credential LSE record, verifies local read, Cloud Backup export, and Prime Transfer export guards, then cleans up test data.';
      confirmTestID = SettingTestIDs.localSecretEnvelopeRestoreSelfTestConfirm;
    } else if (isDiagnostic) {
      description =
        'Read-only scan of existing credentials and the verify-string. Reports encryption method + KDF iterations (tagged confirmed / inferred) per record. For LSE records it peels only the device layer (never the password) to read the exact inner iterations. No secret, ciphertext, or plaintext is exposed.';
      confirmTestID =
        SettingTestIDs.localSecretEnvelopeMigrationDiagnosticConfirm;
    }
    showDevOnlyPasswordDialog({
      title,
      description,
      confirmButtonProps: {
        testID: confirmTestID,
        variant: 'primary',
      },
      onConfirm: async (params) => {
        await runTest(params);
      },
    });
  }, [isDiagnostic, isRestore, runTest, title]);

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
          {pageDescription}
        </SizableText>

        <Button
          variant="primary"
          loading={isRunning}
          disabled={isRunning}
          onPress={handleRun}
          testID={runButtonTestID}
        >
          {runButtonLabel}
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
                  {getSummaryHeading(report.passed)}
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
