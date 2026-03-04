import { useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  Page,
  Progress,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  BundleUpdate,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { useRoute } from '@react-navigation/core';

import type { RouteProp } from '@react-navigation/core';

const PLACEHOLDER_SIGNATURE = 'dev-no-signature';

type IBundleInfo = {
  bundleVersion: string;
  downloadUrl: string;
  sha256: string;
  signature?: string;
  fileSize: number;
  changeLog?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BundleItem({
  bundle,
  version,
  isCurrentBundle,
  alreadyDownloaded,
  isDownloading,
  onDownloadStart,
  onDownloadEnd,
}: {
  bundle: IBundleInfo;
  version: string;
  isCurrentBundle: boolean;
  alreadyDownloaded: boolean;
  isDownloading: boolean;
  onDownloadStart: () => void;
  onDownloadEnd: () => void;
}) {
  const downloadPercent = useDownloadProgress();
  const [status, setStatus] = useState<
    'idle' | 'downloading' | 'downloaded' | 'installing' | 'error'
  >(alreadyDownloaded ? 'downloaded' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const downloadedEventRef = useRef<Record<string, unknown> | null>(null);

  const handleDownload = useCallback(async () => {
    onDownloadStart();
    setStatus('downloading');
    setErrorMessage('');
    try {
      const result = await BundleUpdate.downloadBundle({
        downloadUrl: bundle.downloadUrl,
        latestVersion: version,
        bundleVersion: bundle.bundleVersion,
        fileSize: bundle.fileSize,
        sha256: bundle.sha256,
      });
      if (result) {
        downloadedEventRef.current = {
          ...result,
          signature: bundle.signature,
        };
        setStatus('downloaded');
      } else {
        setStatus('error');
        setErrorMessage('Download returned empty result');
      }
    } catch (e) {
      setStatus('error');
      setErrorMessage((e as Error)?.message || 'Download failed');
    } finally {
      onDownloadEnd();
    }
  }, [bundle, version, onDownloadStart, onDownloadEnd]);

  const handleInstall = useCallback(async () => {
    setStatus('installing');
    try {
      if (alreadyDownloaded && !downloadedEventRef.current) {
        await BundleUpdate.verifyExtractedBundle(version, bundle.bundleVersion);
        await BundleUpdate.installBundle({
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification: !!process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION,
        });
      } else {
        if (!downloadedEventRef.current) return;
        await BundleUpdate.verifyBundleASC({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification: !!process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION,
        });

        await BundleUpdate.verifyBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          skipGPGVerification: !!process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION,
        });

        await BundleUpdate.installBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification: !!process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION,
        });
      }
    } catch (e) {
      setStatus('error');
      setErrorMessage((e as Error)?.message || 'Install failed');
    }
  }, [alreadyDownloaded, bundle, version]);

  const downloadDisabled = isDownloading && status !== 'downloading';

  return (
    <YStack px="$4" py="$3" gap="$2.5">
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2" flex={1}>
          <Stack
            w="$8"
            h="$8"
            borderRadius="$2"
            bg={isCurrentBundle ? '$bgSuccessStrong' : '$bgStrong'}
            alignItems="center"
            justifyContent="center"
          >
            {isCurrentBundle ? (
              <Icon name="CheckRadioSolid" size="$4.5" color="$iconInverse" />
            ) : (
              <SizableText size="$bodySmMedium" color="$text">
                {`#${bundle.bundleVersion}`}
              </SizableText>
            )}
          </Stack>
          <YStack flex={1}>
            <XStack alignItems="center" gap="$1.5">
              <SizableText size="$bodyMdMedium">
                {`Bundle ${bundle.bundleVersion}`}
              </SizableText>
              {isCurrentBundle ? (
                <Badge badgeType="success" badgeSize="sm">
                  <Badge.Text>Active</Badge.Text>
                </Badge>
              ) : null}
              {status === 'downloaded' && !isCurrentBundle ? (
                <Badge badgeType="info" badgeSize="sm">
                  <Badge.Text>Ready</Badge.Text>
                </Badge>
              ) : null}
            </XStack>
            <SizableText size="$bodyXs" color="$textSubdued">
              {formatFileSize(bundle.fileSize)}
              {bundle.changeLog ? ` · ${bundle.changeLog}` : ''}
            </SizableText>
          </YStack>
        </XStack>

        {!isCurrentBundle && (status === 'idle' || status === 'error') ? (
          <IconButton
            icon="DownloadOutline"
            size="small"
            variant="tertiary"
            disabled={downloadDisabled}
            onPress={handleDownload}
          />
        ) : null}
      </XStack>

      {status === 'downloading' ? (
        <YStack gap="$1" pl="$10">
          <Progress value={downloadPercent} />
          <SizableText size="$bodyXs" color="$textSubdued">
            {`Downloading... ${downloadPercent}%`}
          </SizableText>
        </YStack>
      ) : null}

      {status === 'error' ? (
        <XStack pl="$10" alignItems="center" gap="$1.5">
          <Icon name="XCircleOutline" size="$3.5" color="$iconCritical" />
          <SizableText size="$bodyXs" color="$textCritical">
            {errorMessage}
          </SizableText>
        </XStack>
      ) : null}

      {status === 'installing' ? (
        <XStack pl="$10" alignItems="center" gap="$2">
          <Spinner size="small" />
          <SizableText size="$bodyXs" color="$textSubdued">
            Installing & restarting...
          </SizableText>
        </XStack>
      ) : null}

      {!isCurrentBundle && status === 'downloaded' ? (
        <Stack pl="$10">
          <Button variant="primary" size="small" onPress={handleInstall}>
            Switch to This Bundle
          </Button>
        </Stack>
      ) : null}
    </YStack>
  );
}

export default function SettingDevBundleList() {
  const route =
    useRoute<
      RouteProp<
        IModalSettingParamList,
        EModalSettingRoutes.SettingDevBundleList
      >
    >();
  const { version } = route.params;
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<IBundleInfo[]>([]);
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentAppVersion = String(platformEnv.version);

  useEffect(() => {
    void (async () => {
      try {
        const data =
          await backgroundApiProxy.serviceAppUpdate.devFetchBundlesForVersion(
            version,
          );
        setBundles(data);

        const existsChecks = await Promise.all(
          data.map(async (b) => ({
            bundleVersion: b.bundleVersion,
            exists: await BundleUpdate.isBundleExists(version, b.bundleVersion),
          })),
        );
        const downloaded = new Set<string>();
        for (const check of existsChecks) {
          if (check.exists) {
            downloaded.add(check.bundleVersion);
          }
        }
        setDownloadedSet(downloaded);
      } finally {
        setLoading(false);
      }
    })();
  }, [version]);

  const handleDownloadStart = useCallback(() => {
    setIsDownloading(true);
  }, []);

  const handleDownloadEnd = useCallback(() => {
    setIsDownloading(false);
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title={`v${version} Bundles`} />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack px="$5" py="$4" gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$bodySm" color="$textSubdued">
                {`Current: v${currentAppVersion} #${currentBundleVersion}`}
              </SizableText>
              <Badge badgeType="warning" badgeSize="sm">
                <Badge.Text>GPG Skipped</Badge.Text>
              </Badge>
            </XStack>

            <YStack
              bg="$bgSubdued"
              borderRadius="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$neutral3"
              overflow="hidden"
            >
              {bundles.map((bundle, index) => (
                <YStack key={bundle.bundleVersion}>
                  {index > 0 ? (
                    <XStack mx="$4">
                      <Divider />
                    </XStack>
                  ) : null}
                  <BundleItem
                    bundle={bundle}
                    version={version}
                    isCurrentBundle={
                      version === currentAppVersion &&
                      bundle.bundleVersion === currentBundleVersion
                    }
                    alreadyDownloaded={downloadedSet.has(bundle.bundleVersion)}
                    isDownloading={isDownloading}
                    onDownloadStart={handleDownloadStart}
                    onDownloadEnd={handleDownloadEnd}
                  />
                </YStack>
              ))}
            </YStack>

            {bundles.length === 0 ? (
              <YStack py="$10" alignItems="center" gap="$2">
                <Icon name="InboxOutline" size="$10" color="$iconDisabled" />
                <SizableText color="$textDisabled">
                  No bundles for this version
                </SizableText>
              </YStack>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
