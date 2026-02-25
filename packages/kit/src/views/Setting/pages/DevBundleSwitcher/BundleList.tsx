import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Divider,
  IconButton,
  Page,
  Progress,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import type { RouteProp } from '@react-navigation/core';

import { useRoute } from '@react-navigation/core';

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
          skipGPGVerification: true,
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
        // Verify file integrity before switching
        await BundleUpdate.verifyExtractedBundle(
          version,
          bundle.bundleVersion,
        );
        await BundleUpdate.installBundle({
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || 'dev-no-signature',
          skipGPGVerification: true,
        } as any);
      } else {
        if (!downloadedEventRef.current) return;
        await BundleUpdate.verifyBundleASC({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          signature: bundle.signature || '',
          skipGPGVerification: true,
        } as any);

        await BundleUpdate.verifyBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
        } as any);

        await BundleUpdate.installBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || 'dev-no-signature',
          skipGPGVerification: true,
        } as any);
      }
    } catch (e) {
      setStatus('error');
      setErrorMessage((e as Error)?.message || 'Install failed');
    }
  }, [alreadyDownloaded, bundle, version]);

  // Whether this item's download button should be disabled
  // (another bundle is currently downloading)
  const downloadDisabled = isDownloading && status !== 'downloading';

  return (
    <YStack
      p="$3"
      borderRadius="$3"
      bg="$bgSubdued"
      gap="$2"
    >
      <Stack
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack flexDirection="row" alignItems="center" gap="$2" flex={1}>
          <SizableText size="$bodyLgMedium">
            {`Bundle ${bundle.bundleVersion}`}
          </SizableText>
          {isCurrentBundle ? (
            <Badge badgeType="success" badgeSize="sm">
              <Badge.Text>Current</Badge.Text>
            </Badge>
          ) : null}
        </Stack>
        <Stack flexDirection="row" alignItems="center" gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            {formatFileSize(bundle.fileSize)}
          </SizableText>
          {!isCurrentBundle && (status === 'idle' || status === 'error') ? (
            <IconButton
              icon="DownloadOutline"
              size="small"
              variant="tertiary"
              disabled={downloadDisabled}
              onPress={handleDownload}
            />
          ) : null}
        </Stack>
      </Stack>

      {bundle.changeLog ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {bundle.changeLog}
        </SizableText>
      ) : null}

      {status === 'downloading' ? (
        <YStack gap="$1">
          <Progress value={downloadPercent} />
          <SizableText size="$bodySm" color="$textSubdued">
            {`Downloading... ${downloadPercent}%`}
          </SizableText>
        </YStack>
      ) : null}

      {status === 'error' ? (
        <SizableText size="$bodySm" color="$textCritical">
          {`Error: ${errorMessage}`}
        </SizableText>
      ) : null}

      {status === 'installing' ? (
        <Stack flexDirection="row" alignItems="center" gap="$2">
          <Spinner size="small" />
          <SizableText size="$bodySm">Installing & restarting...</SizableText>
        </Stack>
      ) : null}

      {!isCurrentBundle && status === 'downloaded' ? (
        <Button
          variant="primary"
          size="small"
          onPress={handleInstall}
        >
          Switch to this bundle
        </Button>
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
      <Page.Header title={`Bundles for ${version}`} />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack p="$4" gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {`Current: ${currentAppVersion} / bundle ${currentBundleVersion}`}
            </SizableText>
            <SizableText size="$bodySm" color="$textCaution">
              GPG verification is disabled in this mode
            </SizableText>
            <Divider />
            {bundles.map((bundle) => (
              <BundleItem
                key={bundle.bundleVersion}
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
            ))}
            {bundles.length === 0 ? (
              <SizableText color="$textSubdued" textAlign="center">
                No bundles available for this version
              </SizableText>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
