import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Input,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IJSBundle } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { getJsBundlePathAsync } from '@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function BundleTestsContent({
  showTestResult,
  showTestError,
}: {
  showTestResult: (
    result: boolean | { success: boolean; message: string },
  ) => void;
  showTestError: (error: unknown) => void;
}) {
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [bundleVersion, setBundleVersion] = useState('1');
  return (
    <YStack p="$4" gap="$2">
      <YStack gap="$2" mb="$3">
        <SizableText size="$bodyMd">Version Configuration</SizableText>
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
      </YStack>
      <Divider />
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
  );
}

export default function DevAppUpdateModalSettingModal() {
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
        <BundleTestsContent
          showTestResult={showTestResult}
          showTestError={showTestError}
        />
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

  const currentAppVersion = String(platformEnv.version);
  const currentBuildNumber = String(platformEnv.buildNumber);
  const currentBundleVersion = String(platformEnv.bundleVersion);
  const [jsBundlePath, setJsBundlePath] = useState('');
  const [fallbackBundles, setFallbackBundles] = useState<IJSBundle[]>([]);
  const [nativeAppVersion, setNativeAppVersion] = useState('');
  const [nativeBuildNumber, setNativeBuildNumber] = useState('');

  useEffect(() => {
    void getJsBundlePathAsync().then((path) => {
      setJsBundlePath(path);
    });
    void BundleUpdate.getFallbackBundles().then((bundles) => {
      setFallbackBundles(bundles);
    });
    void BundleUpdate.getNativeAppVersion().then((version) => {
      setNativeAppVersion(version);
    });
    void BundleUpdate.getNativeBuildNumber().then((buildNumber) => {
      setNativeBuildNumber(buildNumber);
    });
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="Dev App Update Modal Setting" />
      <Page.Body>
        <YStack p="$4" gap="$4">
          <SizableText size="$headingSm">
            {`Current Version: ${currentAppVersion}-${currentBuildNumber}-${currentBundleVersion}`}
          </SizableText>
          <SizableText size="$headingSm">
            {`Native App Version: ${nativeAppVersion}${
              nativeBuildNumber ? `-${nativeBuildNumber}` : ''
            }`}
          </SizableText>
          {jsBundlePath ? (
            <SizableText size="$headingSm">
              {`js bundle path: ${jsBundlePath}`}
            </SizableText>
          ) : null}

          {fallbackBundles.length > 0 ? (
            <YStack gap="$2">
              <Divider />
              <SizableText size="$bodyMd">Available Bundles</SizableText>
              <YStack gap="$2">
                {fallbackBundles.map((bundle) => (
                  <Button
                    key={`${bundle.appVersion}-${bundle.bundleVersion}`}
                    variant="secondary"
                    onPress={() => {
                      void BundleUpdate.switchBundle(bundle);
                    }}
                  >
                    {`${bundle.appVersion}-${bundle.bundleVersion}`}
                  </Button>
                ))}
              </YStack>
            </YStack>
          ) : null}

          <Divider />
          <Button variant="secondary" onPress={showFailedTestsDialog}>
            Auto Update Failed Tests
          </Button>

          <Button variant="secondary" onPress={showVerificationTestsDialog}>
            Verification Tests
          </Button>

          <Button variant="secondary" onPress={showBundleTestsDialog}>
            Bundle Tests
          </Button>

          <Divider />

          <Button variant="secondary" onPress={showAppUpdateInfoDialog}>
            Show App Update Info
          </Button>

          <Divider />

          <Button
            variant="secondary"
            onPress={async () => {
              try {
                const result = await BundleUpdate.clearAllJSBundleData();
                Dialog.confirm({
                  title: 'Clear JSBundle Data',
                  description: JSON.stringify(result),
                });
              } catch (error) {
                Dialog.confirm({
                  title: 'Clear JSBundle Data',
                  description: `Error: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                });
              }
            }}
          >
            Clear All JSBundle Data
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
