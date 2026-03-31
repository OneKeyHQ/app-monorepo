import { useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BundleItem,
  normalizeCommitHash,
} from '../../DevBundleSwitcher/BundleList';

import type { IBundleInfo } from '../../DevBundleSwitcher/BundleList';

const currentAppVersion = String(platformEnv.version);
const currentBundleVersion = String(platformEnv.bundleVersion);
const currentCommitHash = normalizeCommitHash(platformEnv.githubSHA);

function checkIsCurrentBundle(
  bundle: IBundleInfo,
  version: string,
  skipGpgAllowed: boolean,
): boolean {
  if (version !== currentAppVersion) return false;
  if (skipGpgAllowed) {
    const bundleCommitHash = normalizeCommitHash(bundle.commitHash);
    if (bundleCommitHash && currentCommitHash) {
      return bundleCommitHash === currentCommitHash;
    }
  }
  return bundle.ciBundleVersion === currentBundleVersion;
}

const SEARCH_DEBOUNCE_MS = 500;

export function BundleCommitSearch({ searchText }: { searchText: string }) {
  const [searching, setSearching] = useState(!!searchText.trim());
  const [searchResults, setSearchResults] = useState<
    { version: string; bundle: IBundleInfo }[]
  >([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [gpgSkipped, setGpgSkipped] = useState(false);
  const [skipGpgVerificationAllowed, setSkipGpgVerificationAllowed] =
    useState(false);
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const searchIdRef = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const [skipGpg, isSkipAllowed] = await Promise.all([
          backgroundApiProxy.serviceDevSetting.getSkipBundleGPGVerification(),
          BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false),
        ]);
        setGpgSkipped(skipGpg);
        setSkipGpgVerificationAllowed(Boolean(isSkipAllowed));
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      searchIdRef.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;
    setSearching(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results =
            await backgroundApiProxy.serviceAppUpdate.devSearchBundleByCommit(
              trimmed,
            );
          if (currentSearchId !== searchIdRef.current) return;
          setSearchResults(results);

          const downloaded = new Set<string>();
          await Promise.all(
            results.map(async (r) => {
              try {
                const exists = await BundleUpdate.isBundleExists(
                  r.version,
                  r.bundle.ciBundleVersion,
                );
                if (exists) {
                  downloaded.add(`${r.version}:${r.bundle.ciBundleVersion}`);
                }
              } catch {
                // ignore
              }
            }),
          );
          if (currentSearchId !== searchIdRef.current) return;
          setDownloadedSet(downloaded);
        } finally {
          if (currentSearchId === searchIdRef.current) {
            setSearching(false);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      searchIdRef.current += 1;
    };
  }, [searchText]);

  const handleDownloadStart = useCallback(() => {
    setIsDownloading(true);
  }, []);

  const handleDownloadEnd = useCallback(() => {
    setIsDownloading(false);
  }, []);

  return (
    <YStack px="$3" gap="$1.5" pb="$2">
      <XStack alignItems="center" gap="$1.5" px="$1">
        <Icon name="CodeOutline" size="$4" color="$textSubdued" />
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Bundle Commit Search
        </SizableText>
      </XStack>
      {searching ? (
        <Stack py="$4" justifyContent="center" alignItems="center">
          <Spinner size="small" />
        </Stack>
      ) : null}
      {!searching && searchResults.length > 0
        ? searchResults.map((result) => (
            <YStack
              key={`${result.version}-${result.bundle.ciBundleVersion}`}
              gap="$1"
            >
              <SizableText size="$bodyXs" color="$textSubdued" px="$1">
                {`v${result.version}`}
              </SizableText>
              <YStack
                bg="$bgSubdued"
                borderRadius="$3"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$neutral3"
                overflow="hidden"
              >
                <BundleItem
                  bundle={result.bundle}
                  version={result.version}
                  isCurrentBundle={checkIsCurrentBundle(
                    result.bundle,
                    result.version,
                    skipGpgVerificationAllowed,
                  )}
                  alreadyDownloaded={downloadedSet.has(
                    `${result.version}:${result.bundle.ciBundleVersion}`,
                  )}
                  isDownloading={isDownloading}
                  onDownloadStart={handleDownloadStart}
                  onDownloadEnd={handleDownloadEnd}
                  gpgSkipped={gpgSkipped}
                  skipGpgVerificationAllowed={skipGpgVerificationAllowed}
                />
              </YStack>
            </YStack>
          ))
        : null}
      {!searching && searchResults.length === 0 ? (
        <SizableText size="$bodyXs" color="$textDisabled" px="$1">
          No bundles found for this commit
        </SizableText>
      ) : null}
    </YStack>
  );
}
