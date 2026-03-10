import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  BundleUpdate,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

const PLACEHOLDER_SIGNATURE = 'dev-no-signature';

type IBundleInfo = {
  bundleVersion: string;
  downloadUrl: string;
  sha256: string;
  signature?: string;
  fileSize: number;
  commitHash?: string;
  changeLog?: string;
};

function normalizeCommitHash(commitHash?: string) {
  return String(commitHash || '')
    .trim()
    .toLowerCase();
}

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
  gpgSkipped,
  skipGpgVerificationAllowed,
}: {
  bundle: IBundleInfo;
  version: string;
  isCurrentBundle: boolean;
  alreadyDownloaded: boolean;
  isDownloading: boolean;
  onDownloadStart: () => void;
  onDownloadEnd: () => void;
  gpgSkipped: boolean;
  skipGpgVerificationAllowed: boolean;
}) {
  const downloadPercent = useDownloadProgress();
  const [status, setStatus] = useState<
    'idle' | 'downloading' | 'downloaded' | 'installing' | 'error'
  >(alreadyDownloaded ? 'downloaded' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const downloadedEventRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (alreadyDownloaded && status === 'idle') {
      setStatus('downloaded');
    }
  }, [alreadyDownloaded, status]);

  const handleDownload = useCallback(async () => {
    const skipGPGVerification = skipGpgVerificationAllowed && gpgSkipped;
    onDownloadStart();
    setStatus('downloading');
    setErrorMessage('');
    defaultLogger.app.jsBundleDev.downloadBundle({
      version,
      bundleVersion: bundle.bundleVersion,
      downloadUrl: bundle.downloadUrl,
      fileSize: bundle.fileSize,
    });
    try {
      const result = await BundleUpdate.downloadBundle({
        downloadUrl: bundle.downloadUrl,
        latestVersion: version,
        bundleVersion: bundle.bundleVersion,
        fileSize: bundle.fileSize,
        sha256: bundle.sha256,
        skipGPGVerification,
      });
      if (result) {
        await BundleUpdate.verifyBundleASC({
          ...result,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification,
        });
        downloadedEventRef.current = {
          ...result,
          signature: bundle.signature,
          skipGPGVerification,
        };
        setStatus('downloaded');
        defaultLogger.app.jsBundleDev.downloadBundleResult({
          version,
          bundleVersion: bundle.bundleVersion,
          success: true,
        });
      } else {
        setStatus('error');
        setErrorMessage('Download returned empty result');
        defaultLogger.app.jsBundleDev.downloadBundleResult({
          version,
          bundleVersion: bundle.bundleVersion,
          success: false,
          error: 'Download returned empty result',
        });
      }
    } catch (e) {
      const errMsg = (e as Error)?.message || 'Download failed';
      setStatus('error');
      setErrorMessage(errMsg);
      defaultLogger.app.jsBundleDev.downloadBundleResult({
        version,
        bundleVersion: bundle.bundleVersion,
        success: false,
        error: errMsg,
      });
    } finally {
      onDownloadEnd();
    }
  }, [
    bundle,
    version,
    onDownloadStart,
    onDownloadEnd,
    gpgSkipped,
    skipGpgVerificationAllowed,
  ]);

  const handleInstall = useCallback(async () => {
    const skipGPGVerification = skipGpgVerificationAllowed && gpgSkipped;
    setStatus('installing');
    defaultLogger.app.jsBundleDev.installBundle({
      version,
      bundleVersion: bundle.bundleVersion,
    });
    try {
      if (alreadyDownloaded && !downloadedEventRef.current) {
        await BundleUpdate.verifyExtractedBundle(version, bundle.bundleVersion);
        defaultLogger.app.jsBundleDev.installBundleResult({
          version,
          bundleVersion: bundle.bundleVersion,
          success: true,
        });
        await BundleUpdate.installBundle({
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification,
        });
      } else {
        if (!downloadedEventRef.current) {
          throw new OneKeyLocalError(
            'Downloaded bundle info missing, please download again.',
          );
        }
        await BundleUpdate.verifyBundleASC({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification,
        });

        await BundleUpdate.verifyBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          sha256: bundle.sha256,
          skipGPGVerification,
        });

        defaultLogger.app.jsBundleDev.installBundleResult({
          version,
          bundleVersion: bundle.bundleVersion,
          success: true,
        });
        await BundleUpdate.installBundle({
          ...downloadedEventRef.current,
          latestVersion: version,
          bundleVersion: bundle.bundleVersion,
          signature: bundle.signature || PLACEHOLDER_SIGNATURE,
          skipGPGVerification,
        });
      }
    } catch (e) {
      const errMsg = (e as Error)?.message || 'Install failed';
      setStatus('error');
      setErrorMessage(errMsg);
      defaultLogger.app.jsBundleDev.installBundleResult({
        version,
        bundleVersion: bundle.bundleVersion,
        success: false,
        error: errMsg,
      });
    }
  }, [
    alreadyDownloaded,
    bundle,
    version,
    gpgSkipped,
    skipGpgVerificationAllowed,
  ]);

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
            <XStack alignItems="center" gap="$2">
              <SizableText size="$bodyXs" color="$textSubdued" flex={1}>
                {formatFileSize(bundle.fileSize)}
                {bundle.changeLog ? ` · ${bundle.changeLog}` : ''}
              </SizableText>
            </XStack>
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
        <XStack pl="$10" justifyContent="flex-end">
          <Button
            variant="primary"
            size="small"
            alignSelf="flex-end"
            px="$3"
            onPress={handleInstall}
          >
            Switch
          </Button>
        </XStack>
      ) : null}

      {bundle.commitHash ? (
        <XStack pl="$10" justifyContent="flex-end">
          <SizableText size="$bodyXs" color="$textSubdued">
            {bundle.commitHash.slice(0, 8)}
          </SizableText>
        </XStack>
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
  const [gpgSkipped, setGpgSkipped] = useState(false);
  const [skipGpgVerificationAllowed, setSkipGpgVerificationAllowed] =
    useState(false);

  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentAppVersion = String(platformEnv.version);
  const currentCommitHash = normalizeCommitHash(platformEnv.githubSHA);
  const currentBundleLabel =
    skipGpgVerificationAllowed && currentCommitHash
      ? currentCommitHash.slice(0, 8)
      : `#${currentBundleVersion}`;

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const [data, skipGpg, localBundles, isSkipAllowed] = await Promise.all([
          backgroundApiProxy.serviceAppUpdate.devFetchBundlesForVersion(
            version,
          ),
          backgroundApiProxy.serviceDevSetting.getSkipBundleGPGVerification(),
          BundleUpdate.listLocalBundles().catch(() => []),
          BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false),
        ]);
        if (!isMounted) return;

        setGpgSkipped(skipGpg);
        setSkipGpgVerificationAllowed(Boolean(isSkipAllowed));
        setBundles(data);

        const downloaded = new Set<string>(
          localBundles
            .filter((b) => String(b.appVersion) === String(version))
            .map((b) => String(b.bundleVersion)),
        );

        const existsChecks = await Promise.all(
          data.map(async (b) => ({
            bundleVersion: b.bundleVersion,
            exists: await BundleUpdate.isBundleExists(version, b.bundleVersion),
          })),
        );
        for (const check of existsChecks) {
          defaultLogger.app.jsBundleDev.checkBundleExists({
            version,
            bundleVersion: check.bundleVersion,
            exists: check.exists,
          });
          if (check.exists) {
            downloaded.add(check.bundleVersion);
          }
        }
        if (isMounted) {
          setDownloadedSet(downloaded);
        }
      } catch (e) {
        defaultLogger.app.jsBundleDev.fetchBundlesError({
          version,
          error: (e as Error)?.message || 'Unknown error',
        });
        if (isMounted) {
          setBundles([]);
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
                {`Current: v${currentAppVersion} ${currentBundleLabel}`}
              </SizableText>
              {skipGpgVerificationAllowed && gpgSkipped ? (
                <Badge badgeType="warning" badgeSize="sm">
                  <Badge.Text>GPG Skipped</Badge.Text>
                </Badge>
              ) : null}
            </XStack>

            <YStack
              bg="$bgSubdued"
              borderRadius="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$neutral3"
              overflow="hidden"
            >
              {bundles.map((bundle, index) => (
                <YStack
                  key={`${bundle.bundleVersion}-${bundle.commitHash || index}`}
                >
                  {index > 0 ? (
                    <XStack mx="$4">
                      <Divider />
                    </XStack>
                  ) : null}
                  <BundleItem
                    bundle={bundle}
                    version={version}
                    isCurrentBundle={(() => {
                      if (version !== currentAppVersion) {
                        return false;
                      }
                      if (skipGpgVerificationAllowed) {
                        const bundleCommitHash = normalizeCommitHash(
                          bundle.commitHash,
                        );
                        if (bundleCommitHash && currentCommitHash) {
                          return bundleCommitHash === currentCommitHash;
                        }
                      }
                      return bundle.bundleVersion === currentBundleVersion;
                    })()}
                    alreadyDownloaded={downloadedSet.has(bundle.bundleVersion)}
                    isDownloading={isDownloading}
                    onDownloadStart={handleDownloadStart}
                    onDownloadEnd={handleDownloadEnd}
                    gpgSkipped={gpgSkipped}
                    skipGpgVerificationAllowed={skipGpgVerificationAllowed}
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
