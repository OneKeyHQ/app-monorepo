import {
  Button,
  Dialog,
  Divider,
  Page,
  SizableText,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { AppUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import SkipGPGVerificationToggle from './SkipGPGVerificationToggle';

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
