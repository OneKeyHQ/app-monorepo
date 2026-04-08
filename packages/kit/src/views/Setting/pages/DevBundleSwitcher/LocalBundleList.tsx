import { useCallback, useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Divider,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { encodeBundleVersionForDisplay } from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ILocalBundle = { appVersion: string; bundleVersion: string };

function LocalBundleItem({
  bundle,
  isCurrent,
  onSwitch,
  isSwitching,
}: {
  bundle: ILocalBundle;
  isCurrent: boolean;
  onSwitch: (b: ILocalBundle) => void;
  isSwitching: boolean;
}) {
  return (
    <YStack px="$4" py="$3" gap="$2">
      {/* Row 1: app version + bundle hash + status */}
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2" flex={1}>
          {isCurrent ? (
            <Icon name="CheckRadioSolid" size="$4.5" color="$iconSuccess" />
          ) : null}
          <SizableText size="$bodyMdMedium">
            {`v${bundle.appVersion}`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {encodeBundleVersionForDisplay(bundle.bundleVersion)}
          </SizableText>
          {isCurrent ? (
            <Badge badgeType="success" badgeSize="sm">
              <Badge.Text>Active</Badge.Text>
            </Badge>
          ) : null}
        </XStack>
        {!isCurrent ? (
          <Button
            variant="secondary"
            size="small"
            disabled={isSwitching}
            onPress={() => onSwitch(bundle)}
          >
            {isSwitching ? (
              <XStack alignItems="center" gap="$1.5">
                <Spinner size="small" />
                <SizableText size="$bodySm">Switching</SizableText>
              </XStack>
            ) : (
              'Switch'
            )}
          </Button>
        ) : null}
      </XStack>

      {/* Row 2: bundle version number */}
      <SizableText size="$bodyXs" color="$textDisabled">
        {`#${bundle.bundleVersion}`}
      </SizableText>
    </YStack>
  );
}

export default function SettingDevLocalBundleList() {
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<ILocalBundle[]>([]);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentAppVersion = String(platformEnv.version);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const [localBundles, rawFallbackBundles] = await Promise.all([
          BundleUpdate.listLocalBundles().catch(() => []),
          BundleUpdate.getFallbackBundles().catch(() => []),
        ]);
        const fallbackBundles = Array.isArray(rawFallbackBundles)
          ? rawFallbackBundles
          : [];

        const merged = new Map<string, ILocalBundle>();
        for (const b of localBundles) {
          const key = `${b.appVersion}-${b.bundleVersion}`;
          merged.set(key, {
            appVersion: String(b.appVersion),
            bundleVersion: String(b.bundleVersion),
          });
        }

        await Promise.all(
          fallbackBundles.map(async (b) => {
            const appVersion = String(b.appVersion);
            const bundleVersion = String(b.bundleVersion);
            const key = `${appVersion}-${bundleVersion}`;
            if (merged.has(key)) {
              return;
            }
            const exists = await BundleUpdate.isBundleExists(
              appVersion,
              bundleVersion,
            );
            if (exists) {
              merged.set(key, { appVersion, bundleVersion });
            }
          }),
        );

        if (isMounted) {
          setBundles(Array.from(merged.values()));
        }
      } catch (e) {
        defaultLogger.app.jsBundleDev.fetchBundlesError({
          version: currentAppVersion,
          error: (e as Error)?.message || 'Failed to load local bundles',
        });
        if (isMounted) {
          setBundles([]);
          setError((e as Error)?.message || 'Failed to load local bundles');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentAppVersion]);

  const handleSwitch = useCallback(async (bundle: ILocalBundle) => {
    const key = `${bundle.appVersion}-${bundle.bundleVersion}`;
    setSwitchingTo(key);
    setError('');
    try {
      await BundleUpdate.verifyExtractedBundle(
        bundle.appVersion,
        bundle.bundleVersion,
      );
      await backgroundApiProxy.serviceDevSetting.updateDevSetting(
        'ignoreServerBundleUpdate',
        true,
      );
      // await backgroundApiProxy.serviceAppUpdate.reset();
      await backgroundApiProxy.servicePendingInstallTask.clearPendingInstallTask();
      await BundleUpdate.switchBundle({
        ...bundle,
        signature: 'dev-local-switch',
      });
    } catch (e) {
      setError((e as Error)?.message || 'Switch failed');
      setSwitchingTo(null);
    }
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="Local Bundles" />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack px="$5" py="$4" gap="$3">
            {error ? (
              <XStack
                bg="$bgCritical"
                borderRadius="$2"
                py="$2"
                px="$3"
                alignItems="center"
                gap="$2"
              >
                <Icon name="XCircleOutline" size="$4" color="$iconCritical" />
                <SizableText size="$bodySm" color="$textCritical" flex={1}>
                  {error}
                </SizableText>
              </XStack>
            ) : null}

            {bundles.length > 0 ? (
              <>
                <SizableText size="$bodySm" color="$textSubdued">
                  {`${bundles.length} bundle${bundles.length !== 1 ? 's' : ''} on device`}
                </SizableText>
                <YStack
                  bg="$bgSubdued"
                  borderRadius="$3"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$neutral3"
                  overflow="hidden"
                >
                  {bundles.map((bundle, index) => {
                    const key = `${bundle.appVersion}-${bundle.bundleVersion}`;
                    const isCurrent =
                      bundle.appVersion === currentAppVersion &&
                      bundle.bundleVersion === currentBundleVersion;
                    return (
                      <YStack key={key}>
                        {index > 0 ? (
                          <XStack mx="$4">
                            <Divider />
                          </XStack>
                        ) : null}
                        <LocalBundleItem
                          bundle={bundle}
                          isCurrent={isCurrent}
                          onSwitch={handleSwitch}
                          isSwitching={switchingTo === key}
                        />
                      </YStack>
                    );
                  })}
                </YStack>
              </>
            ) : (
              <YStack py="$10" alignItems="center" gap="$2">
                <Icon name="InboxOutline" size="$10" color="$iconDisabled" />
                <SizableText color="$textDisabled">
                  No bundles found on device
                </SizableText>
              </YStack>
            )}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
