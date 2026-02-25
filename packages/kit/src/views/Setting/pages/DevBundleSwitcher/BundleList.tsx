import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Dialog,
  Divider,
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
}: {
  bundle: IBundleInfo;
  version: string;
  isCurrentBundle: boolean;
}) {
  const downloadPercent = useDownloadProgress();
  const [status, setStatus] = useState<
    'idle' | 'downloading' | 'downloaded' | 'installing' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const downloadedEventRef = useRef<Record<string, unknown> | null>(null);

  const handleDownload = useCallback(async () => {
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
    }
  }, [bundle, version]);

  const handleInstall = useCallback(async () => {
    if (!downloadedEventRef.current) return;
    setStatus('installing');
    try {
      // Skip GPG: call verifyBundleASC with skipGPGVerification flag
      await BundleUpdate.verifyBundleASC({
        ...downloadedEventRef.current,
        latestVersion: version,
        bundleVersion: bundle.bundleVersion,
        sha256: bundle.sha256,
        signature: bundle.signature || '',
        skipGPGVerification: true,
      } as any);

      // Verify extracted files
      await BundleUpdate.verifyBundle({
        ...downloadedEventRef.current,
        latestVersion: version,
        bundleVersion: bundle.bundleVersion,
        sha256: bundle.sha256,
      } as any);

      // Install and restart
      await BundleUpdate.installBundle({
        ...downloadedEventRef.current,
        latestVersion: version,
        bundleVersion: bundle.bundleVersion,
        signature: bundle.signature || 'dev-no-signature',
      } as any);
    } catch (e) {
      setStatus('error');
      setErrorMessage((e as Error)?.message || 'Install failed');
    }
  }, [bundle, version]);

  return (
    <YStack
      p="$3"
      borderRadius="$3"
      bg="$bgSubdued"
      gap="$2"
    >
      <Stack flexDirection="row" alignItems="center" justifyContent="space-between">
        <Stack flexDirection="row" alignItems="center" gap="$2">
          <SizableText size="$bodyLgMedium">
            {`Bundle ${bundle.bundleVersion}`}
          </SizableText>
          {isCurrentBundle ? (
            <Badge badgeType="success" badgeSize="sm">
              <Badge.Text>Current</Badge.Text>
            </Badge>
          ) : null}
        </Stack>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatFileSize(bundle.fileSize)}
        </SizableText>
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

      {!isCurrentBundle ? (
        <Stack flexDirection="row" gap="$2">
          {status === 'idle' || status === 'error' ? (
            <Button
              variant="secondary"
              size="small"
              onPress={handleDownload}
              flex={1}
            >
              Download
            </Button>
          ) : null}
          {status === 'downloaded' ? (
            <Button
              variant="primary"
              size="small"
              onPress={handleInstall}
              flex={1}
            >
              Switch to this bundle
            </Button>
          ) : null}
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

  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentAppVersion = String(platformEnv.version);

  useEffect(() => {
    void backgroundApiProxy.serviceAppUpdate
      .devFetchBundlesForVersion(version)
      .then((data) => {
        setBundles(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [version]);

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
