import { useCallback, useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Icon,
  IconButton,
  Input,
  Page,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import SkipGPGVerificationToggle from '@onekeyhq/kit/src/views/Setting/pages/DevAppUpdateModalSettingModal/SkipGPGVerificationToggle';
import { encodeBundleVersionForDisplay } from '@onekeyhq/shared/src/appUpdate';
import type { IJSBundle } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { getJsBundlePathAsync } from '@onekeyhq/shared/src/modules3rdParty/auto-update/useJsBundle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" py="$1.5">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodySmMedium"
        color="$text"
        flexShrink={1}
        ml="$4"
        textAlign="right"
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      bg="$bgSubdued"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
}) {
  return (
    <XStack alignItems="center" gap="$2" mb="$2">
      <Icon name={icon} size="$4.5" color="$iconSubdued" />
      <SizableText size="$headingXs" color="$textSubdued">
        {title}
      </SizableText>
    </XStack>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  drillIn,
  destructive,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle?: string;
  onPress: () => void;
  drillIn?: boolean;
  destructive?: boolean;
}) {
  return (
    <XStack
      py="$3"
      px="$4"
      alignItems="center"
      gap="$3"
      pressStyle={{ bg: '$bgHover' }}
      onPress={onPress}
    >
      <Stack
        w="$8"
        h="$8"
        borderRadius="$2"
        bg={destructive ? '$bgCritical' : '$bgStrong'}
        alignItems="center"
        justifyContent="center"
      >
        <Icon
          name={icon}
          size="$4.5"
          color={destructive ? '$iconCritical' : '$icon'}
        />
      </Stack>
      <YStack flex={1}>
        <SizableText
          size="$bodyMd"
          color={destructive ? '$textCritical' : '$text'}
        >
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText size="$bodyXs" color="$textSubdued">
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {drillIn ? (
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      ) : null}
    </XStack>
  );
}

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

  const runTest = async (fn: (a: string, b: string) => Promise<unknown>) => {
    try {
      const result = await fn(appVersion, bundleVersion);
      showTestResult(result as boolean | { success: boolean; message: string });
    } catch (error) {
      showTestError(error);
    }
  };

  return (
    <YStack p="$4" gap="$3">
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Target Bundle
        </SizableText>
        <XStack gap="$2">
          <Input
            flex={1}
            placeholder="App Version"
            value={appVersion}
            onChangeText={setAppVersion}
          />
          <Input
            flex={1}
            placeholder="Bundle Version"
            value={bundleVersion}
            onChangeText={setBundleVersion}
          />
        </XStack>
      </YStack>
      <Divider />
      <YStack gap="$2">
        <Button
          variant="secondary"
          size="small"
          onPress={async () => {
            try {
              const result = await BundleUpdate.testVerification();
              showTestResult(result);
            } catch (error) {
              showTestError(error);
            }
          }}
        >
          Verification
        </Button>
        <Button
          variant="secondary"
          size="small"
          onPress={async () => {
            try {
              const result = await BundleUpdate.testSkipVerification();
              showTestResult(result);
            } catch (error) {
              showTestError(error);
            }
          }}
        >
          Skip Verification
        </Button>
        <Button
          variant="secondary"
          size="small"
          onPress={() => runTest(BundleUpdate.testDeleteJsBundle)}
        >
          Delete JsBundle
        </Button>
        <Button
          variant="secondary"
          size="small"
          onPress={() => runTest(BundleUpdate.testDeleteJsRuntimeDir)}
        >
          Delete Runtime Directory
        </Button>
        <Button
          variant="secondary"
          size="small"
          onPress={() => runTest(BundleUpdate.testDeleteMetadataJson)}
        >
          Delete Metadata.json
        </Button>
        <Button
          variant="secondary"
          size="small"
          onPress={() => runTest(BundleUpdate.testWriteEmptyMetadataJson)}
        >
          Write Empty Metadata.json
        </Button>
      </YStack>
    </YStack>
  );
}

async function enableIgnoreServerBundleUpdate() {
  await backgroundApiProxy.serviceDevSetting.updateDevSetting(
    'ignoreServerBundleUpdate',
    true,
  );
  // await backgroundApiProxy.serviceAppUpdate.reset();
  await backgroundApiProxy.servicePendingInstallTask.clearPendingInstallTask();
}

function IgnoreServerBundleUpdateToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void backgroundApiProxy.serviceDevSetting.getDevSetting().then((dev) => {
      setEnabled(!!dev.settings?.ignoreServerBundleUpdate);
    });
  }, []);

  const handleChange = useCallback(async (value: boolean) => {
    setEnabled(value);
    await backgroundApiProxy.serviceDevSetting.updateDevSetting(
      'ignoreServerBundleUpdate',
      value,
    );
    if (value) {
      // await backgroundApiProxy.serviceAppUpdate.reset();
      await backgroundApiProxy.servicePendingInstallTask.clearPendingInstallTask();
    }
  }, []);

  return (
    <XStack alignItems="center" justifyContent="space-between">
      <YStack flex={1} mr="$2">
        <SizableText size="$bodyLgMedium" color="$textCaution">
          Ignore Server Bundle Update
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Prevent server-driven update or rollback when testing a manually
          switched bundle
        </SizableText>
      </YStack>
      <Switch
        size={ESwitchSize.small}
        value={enabled}
        onChange={handleChange}
      />
    </XStack>
  );
}

export default function DevBundleManagerModal() {
  const navigation = useAppNavigation();

  const { copyText } = useClipboard();
  const currentAppVersion = String(platformEnv.version);
  const currentBuildNumber = String(platformEnv.buildNumber);
  const currentCommitHash = String(platformEnv.githubSHA || '-');
  const currentBundleVersion = String(platformEnv.bundleVersion);
  const [jsBundlePath, setJsBundlePath] = useState('');
  const [fallbackBundles, setFallbackBundles] = useState<IJSBundle[]>([]);
  const [nativeAppVersion, setNativeAppVersion] = useState('');
  const [nativeBuildNumber, setNativeBuildNumber] = useState('');
  const [builtinBundleVersion, setBuiltinBundleVersion] = useState('');

  useEffect(() => {
    void getJsBundlePathAsync().then(setJsBundlePath);
    void BundleUpdate.getFallbackBundles().then(setFallbackBundles);
    void BundleUpdate.getNativeAppVersion().then(setNativeAppVersion);
    void BundleUpdate.getNativeBuildNumber().then(setNativeBuildNumber);
    void BundleUpdate.getBuiltinBundleVersion().then(setBuiltinBundleVersion);
  }, []);

  const showTestResult = (
    result: boolean | { success: boolean; message: string },
  ) => {
    Dialog.show({
      title: 'Result',
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
      title: 'Error',
      renderContent: (
        <YStack p="$4">
          <SizableText color="$textCritical">
            {(error as Error)?.message || 'Unknown error'}
          </SizableText>
        </YStack>
      ),
    });
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="JS Bundle Manager" />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$5">
          {/* Runtime Info */}
          <YStack gap="$1">
            <XStack alignItems="center" gap="$2" mb="$2">
              <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
              <SizableText size="$headingXs" color="$textSubdued">
                RUNTIME INFO
              </SizableText>
              <IconButton
                icon="Copy1Outline"
                size="small"
                variant="tertiary"
                onPress={() => {
                  const versionStr = `${currentAppVersion}${currentBuildNumber ? `-${currentBuildNumber}` : ''}(${currentBundleVersion})(${encodeBundleVersionForDisplay(currentBundleVersion)})`;
                  const nativeStr = nativeAppVersion
                    ? `${nativeAppVersion}${nativeBuildNumber ? `-${nativeBuildNumber}` : ''}${builtinBundleVersion ? `(${builtinBundleVersion})(${encodeBundleVersionForDisplay(String(builtinBundleVersion))})` : ''}`
                    : '';
                  const lines = [
                    `Version: ${versionStr}`,
                    nativeStr ? `Native App Version: ${nativeStr}` : '',
                    `Commit Hash: ${currentCommitHash}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                  copyText(lines);
                }}
              />
            </XStack>
            <SectionCard>
              <YStack px="$4" py="$3" gap="$0.5">
                <InfoRow
                  label="Version"
                  value={`${currentAppVersion}${currentBuildNumber ? `-${currentBuildNumber}` : ''}(${currentBundleVersion})(${encodeBundleVersionForDisplay(currentBundleVersion)})`}
                />
                {nativeAppVersion ? (
                  <InfoRow
                    label="Native App Version"
                    value={`${nativeAppVersion}${nativeBuildNumber ? `-${nativeBuildNumber}` : ''}${builtinBundleVersion ? `(${builtinBundleVersion})(${encodeBundleVersionForDisplay(String(builtinBundleVersion))})` : ''}`}
                  />
                ) : null}
                <InfoRow label="Commit Hash" value={currentCommitHash} />
                {jsBundlePath ? (
                  <>
                    <Divider my="$1.5" />
                    <YStack gap="$1">
                      <SizableText size="$bodyXs" color="$textSubdued">
                        Bundle Path
                      </SizableText>
                      <SizableText
                        size="$bodyXs"
                        color="$textSubdued"
                        numberOfLines={2}
                      >
                        {jsBundlePath}
                      </SizableText>
                    </YStack>
                  </>
                ) : null}
              </YStack>
            </SectionCard>
          </YStack>

          {/* Bundle Operations */}
          {platformEnv.isNative || platformEnv.isDesktop ? (
            <YStack gap="$1">
              <SectionTitle icon="SwitchHorOutline" title="BUNDLE OPERATIONS" />
              <SectionCard>
                <ActionRow
                  icon="DownloadOutline"
                  title="Remote Bundle Switcher"
                  subtitle="Download and install bundles from server"
                  drillIn
                  onPress={() => {
                    navigation.push(
                      EModalSettingRoutes.SettingDevBundleVersionList,
                    );
                  }}
                />
                <XStack mx="$4">
                  <Divider />
                </XStack>
                <ActionRow
                  icon="FolderOutline"
                  title="Local Bundles"
                  subtitle="Switch between bundles on device"
                  drillIn
                  onPress={() => {
                    navigation.push(
                      EModalSettingRoutes.SettingDevLocalBundleList,
                    );
                  }}
                />
                <XStack mx="$4">
                  <Divider />
                </XStack>
                <ActionRow
                  icon="UndoOutline"
                  title="Reset to Built-in Bundle"
                  subtitle="Use app's original bundle, keep downloads"
                  destructive
                  onPress={() => {
                    Dialog.show({
                      title: 'Reset to Built-in Bundle',
                      description:
                        'This will reset the app to use the built-in JS bundle. Downloaded bundles will be preserved. The app will restart.',
                      confirmButtonProps: {
                        variant: 'destructive',
                      },
                      onConfirm: async () => {
                        try {
                          await BundleUpdate.resetToBuiltInBundle();
                          BundleUpdate.restart();
                        } catch (error) {
                          showTestError(error);
                        }
                      },
                    });
                  }}
                />
              </SectionCard>
            </YStack>
          ) : null}

          {/* Fallback Bundles */}
          {fallbackBundles.length > 0 ? (
            <YStack gap="$1">
              <SectionTitle icon="Layers2Outline" title="FALLBACK BUNDLES" />
              <SectionCard>
                {fallbackBundles.map((bundle, index) => {
                  const isCurrent =
                    bundle.appVersion === currentAppVersion &&
                    bundle.bundleVersion === currentBundleVersion;
                  return (
                    <YStack
                      key={`${bundle.appVersion}-${bundle.bundleVersion}`}
                    >
                      {index > 0 ? (
                        <XStack mx="$4">
                          <Divider />
                        </XStack>
                      ) : null}
                      <XStack
                        py="$3"
                        px="$4"
                        alignItems="center"
                        justifyContent="space-between"
                        pressStyle={isCurrent ? undefined : { bg: '$bgHover' }}
                        onPress={
                          isCurrent
                            ? undefined
                            : () => {
                                void enableIgnoreServerBundleUpdate()
                                  .then(() => BundleUpdate.switchBundle(bundle))
                                  .catch((e) => {
                                    showTestError(e);
                                  });
                              }
                        }
                      >
                        <XStack alignItems="center" gap="$2">
                          <SizableText size="$bodyMd">
                            {`v${bundle.appVersion}`}
                          </SizableText>
                          <SizableText size="$bodySm" color="$textSubdued">
                            {`#${bundle.bundleVersion}`}
                          </SizableText>
                          {isCurrent ? (
                            <Badge badgeType="success" badgeSize="sm">
                              <Badge.Text>Active</Badge.Text>
                            </Badge>
                          ) : null}
                        </XStack>
                        {!isCurrent ? (
                          <Icon
                            name="SwitchHorOutline"
                            size="$4.5"
                            color="$iconSubdued"
                          />
                        ) : null}
                      </XStack>
                    </YStack>
                  );
                })}
              </SectionCard>
            </YStack>
          ) : null}

          {/* Settings */}
          <YStack gap="$1">
            <SectionTitle icon="SettingsOutline" title="SETTINGS" />
            <SectionCard>
              <YStack px="$4" py="$3">
                <IgnoreServerBundleUpdateToggle />
              </YStack>
              <XStack mx="$4">
                <Divider />
              </XStack>
              <YStack px="$4" py="$3">
                <SkipGPGVerificationToggle />
              </YStack>
            </SectionCard>
          </YStack>

          {/* Diagnostics */}
          <YStack gap="$1">
            <SectionTitle icon="CubeOutline" title="DIAGNOSTICS" />
            <SectionCard>
              <ActionRow
                icon="ShieldCheckDoneOutline"
                title="Test Verification"
                subtitle="Run BundleUpdate.testVerification()"
                onPress={() => {
                  void (async () => {
                    try {
                      const result = await BundleUpdate.testVerification();
                      showTestResult(result);
                    } catch (error) {
                      showTestError(error);
                    }
                  })();
                }}
              />
              <XStack mx="$4">
                <Divider />
              </XStack>
              <ActionRow
                icon="ShieldExclamationOutline"
                title="Test Skip Verification"
                subtitle="Run BundleUpdate.testSkipVerification()"
                onPress={() => {
                  void (async () => {
                    try {
                      const result = await BundleUpdate.testSkipVerification();
                      showTestResult(result);
                    } catch (error) {
                      showTestError(error);
                    }
                  })();
                }}
              />
              <XStack mx="$4">
                <Divider />
              </XStack>
              <ActionRow
                icon="ToolboxOutline"
                title="Bundle Manipulation"
                subtitle="Delete or corrupt bundle files for testing"
                onPress={() => {
                  Dialog.show({
                    title: 'Bundle Manipulation',
                    floatingPanelProps: { w: '$96' },
                    renderContent: (
                      <BundleTestsContent
                        showTestResult={showTestResult}
                        showTestError={showTestError}
                      />
                    ),
                  });
                }}
              />
              <XStack mx="$4">
                <Divider />
              </XStack>
              <ActionRow
                icon="DeleteOutline"
                title="Clear All Bundle Data"
                subtitle="Remove all downloaded bundles and reset state"
                destructive
                onPress={() => {
                  Dialog.show({
                    title: 'Clear All Bundle Data',
                    description:
                      'This will remove all downloaded JS bundles and reset the bundle state. The app will restart.',
                    confirmButtonProps: {
                      variant: 'destructive',
                    },
                    onConfirm: async () => {
                      try {
                        const result =
                          await BundleUpdate.clearAllJSBundleData();
                        setFallbackBundles([]);
                        Dialog.show({
                          title: 'Cleared',
                          renderContent: (
                            <YStack p="$4">
                              <SizableText>
                                {JSON.stringify(result)}
                              </SizableText>
                            </YStack>
                          ),
                        });
                      } catch (error) {
                        showTestError(error);
                      }
                    },
                  });
                }}
              />
            </SectionCard>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
