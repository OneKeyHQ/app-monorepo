import {
  Button,
  Dialog,
  Divider,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import SkipGPGVerificationToggle from './SkipGPGVerificationToggle';

export default function DevAppUpdateTestModal() {
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

  const showAppUpdateInfoDialog = async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    Dialog.show({
      title: 'App Update Info',
      renderContent: <SizableText>{JSON.stringify(appUpdateInfo)}</SizableText>,
    });
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Dev App Update Test" />
      <Page.Body>
        <YStack p="$4" gap="$4">
          <SkipGPGVerificationToggle />

          <Divider />

          <Button variant="secondary" onPress={showFailedTestsDialog}>
            Auto Update Failed Tests
          </Button>

          <Divider />

          <Button variant="secondary" onPress={showAppUpdateInfoDialog}>
            Show App Update Info
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
