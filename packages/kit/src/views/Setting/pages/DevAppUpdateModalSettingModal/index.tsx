import { useState } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Page,
  SegmentControl,
  SizableText,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  clearWhatsNewShown,
} from '@onekeyhq/shared/src/appUpdate';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { AppUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import SkipGPGVerificationToggle from './SkipGPGVerificationToggle';

const FILE_TYPE_OPTIONS = [
  { label: '大版本 appShell', value: EUpdateFileType.appShell },
  { label: '热更新 jsBundle', value: EUpdateFileType.jsBundle },
];

const STRATEGY_OPTIONS = [
  { label: 'silent', value: EUpdateStrategy.silent },
  { label: 'manual', value: EUpdateStrategy.manual },
  { label: 'force', value: EUpdateStrategy.force },
  { label: 'seamless', value: EUpdateStrategy.seamless },
];

const CHANNEL_OPTIONS = [
  { label: '直链 direct', value: 'direct' },
  { label: '商店 store', value: 'store' },
];

// Curated status list — the ones that change the prompt / reminder / modal UI.
const STATUS_OPTIONS: EAppUpdateStatus[] = [
  EAppUpdateStatus.notify,
  EAppUpdateStatus.downloadPackage,
  EAppUpdateStatus.downloadASC,
  EAppUpdateStatus.verifyASC,
  EAppUpdateStatus.verifyPackage,
  EAppUpdateStatus.ready,
  EAppUpdateStatus.failed,
  EAppUpdateStatus.updateIncomplete,
  EAppUpdateStatus.manualInstall,
  EAppUpdateStatus.done,
];

function SimulateUpdateScenario() {
  const [fileType, setFileType] = useState<EUpdateFileType>(
    EUpdateFileType.appShell,
  );
  const [updateStrategy, setUpdateStrategy] = useState<EUpdateStrategy>(
    EUpdateStrategy.manual,
  );
  const [channel, setChannel] = useState<'direct' | 'store'>('direct');
  const [status, setStatus] = useState<EAppUpdateStatus>(
    EAppUpdateStatus.notify,
  );

  const apply = async () => {
    await backgroundApiProxy.serviceAppUpdate.devSimulateUpdate({
      fileType,
      updateStrategy,
      status,
      channel,
    });
    Toast.success({
      title: 'Scenario applied',
      message: `${
        fileType === EUpdateFileType.jsBundle ? 'jsBundle' : 'appShell'
      } · strategy=${updateStrategy} · ${status}${
        fileType === EUpdateFileType.appShell ? ` · ${channel}` : ''
      }`,
    });
  };

  const isAppShell = fileType === EUpdateFileType.appShell;

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">Simulate Update Scenario</SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        Seeds the update state so you can verify the prompt dot / desktop Update
        button / reminder and the click routing. For a real download + restart,
        use Dev Bundle Manager instead.
      </SizableText>

      <SizableText size="$bodyMdMedium">Update type</SizableText>
      <SegmentControl
        fullWidth
        value={fileType}
        options={FILE_TYPE_OPTIONS}
        onChange={(v) => setFileType(v as EUpdateFileType)}
      />

      <SizableText size="$bodyMdMedium">Strategy</SizableText>
      <SegmentControl
        fullWidth
        value={updateStrategy}
        options={STRATEGY_OPTIONS}
        onChange={(v) => setUpdateStrategy(v as EUpdateStrategy)}
      />

      {isAppShell ? (
        <>
          <SizableText size="$bodyMdMedium">Channel (appShell)</SizableText>
          <SegmentControl
            fullWidth
            value={channel}
            options={CHANNEL_OPTIONS}
            onChange={(v) => setChannel(v as 'direct' | 'store')}
          />
        </>
      ) : null}

      <SizableText size="$bodyMdMedium">Status</SizableText>
      <XStack flexWrap="wrap" gap="$2">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            size="small"
            variant={status === s ? 'accent' : 'secondary'}
            onPress={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </XStack>

      <Button variant="primary" onPress={apply}>
        Apply Scenario
      </Button>
    </YStack>
  );
}

export default function DevAppUpdateTestModal() {
  const { copyText } = useClipboard();
  const showResultDialog = (title: string, content: string) => {
    Dialog.show({
      title,
      renderContent: (
        <YStack p="$4">
          <SizableText>{content}</SizableText>
        </YStack>
      ),
    });
  };

  const runAppUpdateVerificationTest = async (skipGPGVerification: boolean) => {
    try {
      const updateInfo =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const params = updateInfo.downloadedEvent;
      if (!params?.downloadUrl) {
        throw new OneKeyLocalError(
          'No downloaded app package found. Please download app update package first.',
        );
      }
      await AppUpdate.verifyASC({
        ...params,
        skipGPGVerification,
      });
      await AppUpdate.verifyPackage({
        ...params,
        skipGPGVerification,
      });
      showResultDialog(
        skipGPGVerification
          ? 'AppUpdate Skip Verification'
          : 'AppUpdate Verification',
        'Success',
      );
    } catch (error) {
      showResultDialog(
        skipGPGVerification
          ? 'AppUpdate Skip Verification'
          : 'AppUpdate Verification',
        (error as Error)?.message || 'Unknown error',
      );
    }
  };

  const showFailedTestsDialog = () => {
    Dialog.show({
      title: 'Auto Update Failed Tests',
      floatingPanelProps: {
        w: '$96',
      },
      renderContent: (
        <YStack p="$4" gap="$2">
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.downloadPackageFailed({
                message: '404',
              });
            }}
          >
            Download Package Failed
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.downloadASCFailed({
                message: '404',
              });
            }}
          >
            Download ASC Failed
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.verifyASCFailed({
                message:
                  ETranslations.update_signature_verification_failed_alert_text,
              });
            }}
          >
            Verify ASC Failed (Signature)
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.verifyASCFailed({
                message:
                  ETranslations.update_installation_package_possibly_compromised,
              });
            }}
          >
            Verify ASC Failed (Compromised)
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.verifyPackageFailed({
                message:
                  ETranslations.update_installation_package_possibly_compromised,
              });
            }}
          >
            Verify Package Failed (Compromised)
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.verifyPackageFailed({
                message: ETranslations.update_installation_not_safe_alert_text,
              });
            }}
          >
            Verify Package Failed (Not Safe)
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.resetToInComplete();
            }}
          >
            Reset to Incomplete
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void backgroundApiProxy.serviceAppUpdate.resetToManualInstall();
            }}
          >
            Reset to Manual Install
          </Button>
        </YStack>
      ),
    });
  };

  const copyAppUpdateInfo = async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    copyText(JSON.stringify(appUpdateInfo, null, 2));
    Toast.success({ title: 'Copied' });
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Dev App Update Test" />
      <Page.Body>
        <YStack p="$4" gap="$4">
          <SimulateUpdateScenario />

          <Divider />

          <SkipGPGVerificationToggle />

          <Divider />

          <Button
            variant="secondary"
            onPress={() => {
              void runAppUpdateVerificationTest(false);
            }}
          >
            AppUpdate Test Verification
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              void runAppUpdateVerificationTest(true);
            }}
          >
            AppUpdate Test Skip Verification
          </Button>

          <Divider />

          <Button variant="secondary" onPress={showFailedTestsDialog}>
            Auto Update Failed Tests
          </Button>

          <Divider />

          <Button
            variant="secondary"
            onPress={async () => {
              // Wipe the "what's new" marker and force the update status off
              // `done` so that isFirstLaunchAfterUpdated() + isWhatsNewShown()
              // both pass on the next cold start, replaying the changelog dialog.
              clearWhatsNewShown();
              await backgroundApiProxy.serviceAppUpdate.resetToInComplete();
              Toast.success({
                title: "What's New reset",
                message: 'Restart the app to replay the changelog dialog.',
              });
            }}
          >
            {`Reset "What's New" (replay changelog)`}
          </Button>

          <Divider />

          <Button variant="secondary" onPress={copyAppUpdateInfo}>
            Copy App Update Info
          </Button>

          <Button
            variant="secondary"
            onPress={async () => {
              const task =
                await backgroundApiProxy.servicePendingInstallTask.getPendingInstallTask();
              const text = task
                ? JSON.stringify(task, null, 2)
                : 'No pending install task';
              copyText(text);
              Toast.success({ title: 'Copied' });
            }}
          >
            Copy Pending Install Task
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
