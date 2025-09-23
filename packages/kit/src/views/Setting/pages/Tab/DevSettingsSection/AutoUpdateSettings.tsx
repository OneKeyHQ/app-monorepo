import { useState } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Input,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

export function AutoUpdateSettings() {
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [bundleVersion, setBundleVersion] = useState('1');

  const showTestResult = (
    result: boolean | { success: boolean; message: string },
  ) => {
    Dialog.show({
      title: 'Test Result',
      renderContent: (
        <YStack p="$4">
          <SizableText>
            {typeof result === 'boolean'
              ? `Result: ${String(result ? 'Success' : 'Failed')}`
              : `Success: ${String(result.success)}\nMessage: ${String(
                  result.message,
                )}`}
          </SizableText>
        </YStack>
      ),
    });
  };

  const showTestError = (error: unknown) => {
    Dialog.show({
      title: 'Test Error',
      renderContent: (
        <YStack p="$4">
          <SizableText>
            Error: {(error as Error)?.message || 'Unknown error'}
          </SizableText>
        </YStack>
      ),
    });
  };

  const showVersionConfigDialog = () => {
    const dialogInstance = Dialog.show({
      title: 'Version Configuration',
      renderContent: (
        <YStack p="$4" gap="$3">
          <Input
            placeholder="App Version (e.g., 1.0.0)"
            value={appVersion}
            onChangeText={setAppVersion}
          />
          <Input
            placeholder="Bundle Version (e.g., 1)"
            value={bundleVersion}
            onChangeText={setBundleVersion}
          />
          <Button
            variant="primary"
            onPress={async () => {
              await dialogInstance.close();
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              await showMainDialog();
            }}
          >
            Continue
          </Button>
        </YStack>
      ),
    });
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

  const showVerificationTestsDialog = () => {
    Dialog.show({
      title: 'Verification Tests',
      renderContent: (
        <YStack p="$4" gap="$3">
          <Button
            variant="primary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.testVerification();
                showTestResult(result);
              } catch (error) {
                showTestError(error);
              }
            }}
          >
            Test Verification
          </Button>
        </YStack>
      ),
    });
  };

  const showBundleTestsDialog = () => {
    Dialog.show({
      title: 'Bundle Tests',
      floatingPanelProps: {
        w: '$96',
      },
      renderContent: (
        <YStack p="$4" gap="$2">
          <Button
            variant="secondary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.testDeleteJsBundle(
                  appVersion,
                  bundleVersion,
                );
                showTestResult(result);
              } catch (error) {
                showTestError(error);
              }
            }}
          >
            Test Delete JsBundle
          </Button>
          <Button
            variant="secondary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.testDeleteJsRuntimeDir(
                  appVersion,
                  bundleVersion,
                );
                showTestResult(result);
              } catch (error) {
                showTestError(error);
              }
            }}
          >
            Test Delete Js Runtime Directory
          </Button>
          <Button
            variant="secondary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.testDeleteMetadataJson(
                  appVersion,
                  bundleVersion,
                );
                showTestResult(result);
              } catch (error) {
                showTestError(error);
              }
            }}
          >
            Test Delete Metadata.json
          </Button>
          <Button
            variant="secondary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.testWriteEmptyMetadataJson(
                  appVersion,
                  bundleVersion,
                );
                showTestResult(result);
              } catch (error) {
                showTestError(error);
              }
            }}
          >
            Test Write Empty Metadata.json
          </Button>
        </YStack>
      ),
    });
  };

  async function showMainDialog() {
    const currentAppVersion = String(platformEnv.version);
    const currentBuildNumber = String(platformEnv.buildNumber);
    const currentBundleVersion = String(platformEnv.bundleVersion);

    const dialogInstance = Dialog.show({
      title: 'Auto Update Test Suite',
      renderContent: (
        <YStack p="$1" gap="$1">
          <SizableText size="$headingSm">
            {`Current Version: ${currentAppVersion}-${currentBuildNumber}-${currentBundleVersion}`}
          </SizableText>
          {platformEnv.isNativeAndroid ||
          (platformEnv.isDesktop &&
            !platformEnv.isMas &&
            !platformEnv.isDesktopLinuxSnap &&
            !platformEnv.isDesktopWinMsStore) ? (
            <Button
              variant="secondary"
              onPress={() => {
                void dialogInstance.close();
                showFailedTestsDialog();
              }}
            >
              Auto Update Failed Tests
            </Button>
          ) : null}

          <Button
            variant="secondary"
            onPress={() => {
              void dialogInstance.close();
              showVerificationTestsDialog();
            }}
          >
            Verification Tests
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              void dialogInstance.close();
              showBundleTestsDialog();
            }}
          >
            Bundle Tests
          </Button>

          <Divider />

          <Button
            variant="secondary"
            onPress={() => {
              void dialogInstance.close();
              showVersionConfigDialog();
            }}
          >
            Configure Versions
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              void BundleUpdate.clearAllJSBundleData();
            }}
          >
            Clear All JSBundle Data
          </Button>
        </YStack>
      ),
    });
  }

  const showAutoUpdateDialog = () => {
    void showMainDialog();
  };

  return (
    <SectionPressItem
      icon="SettingsOutline"
      title="Open Auto Update Test Suite"
      onPress={showAutoUpdateDialog}
    />
  );
}
