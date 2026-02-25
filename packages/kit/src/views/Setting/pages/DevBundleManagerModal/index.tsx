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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IJSBundle } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { getJsBundlePathAsync } from '@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

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

export default function DevBundleManagerModal() {
  const navigation = useAppNavigation();
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
      <Page.Header title="Dev JS Bundle Manager" />
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
              {`JS Bundle Path: ${jsBundlePath}`}
            </SizableText>
          ) : null}

          {platformEnv.isNative || platformEnv.isDesktop ? (
            <>
              <Divider />
              <Button
                variant="primary"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevBundleVersionList,
                  );
                }}
              >
                JS Bundle Switcher
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  navigation.push(
                    EModalSettingRoutes.SettingDevLocalBundleList,
                  );
                }}
              >
                Local Bundles
              </Button>
            </>
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

          <Button variant="secondary" onPress={showVerificationTestsDialog}>
            Verification Tests
          </Button>

          <Button variant="secondary" onPress={showBundleTestsDialog}>
            Bundle Tests
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
