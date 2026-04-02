import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Divider,
  Icon,
  Page,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { BundleItem, normalizeCommitHash } from './BundleList';

import type { IBundleInfo } from './BundleList';

type IVersionInfo = { version: string; bundleCount: number };

function VersionRow({
  item,
  isCurrent,
  onPress,
}: {
  item: IVersionInfo;
  isCurrent: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      py="$3.5"
      px="$4"
      alignItems="center"
      justifyContent="space-between"
      pressStyle={{ bg: '$bgHover' }}
      onPress={onPress}
    >
      <XStack alignItems="center" gap="$3">
        <Stack
          w="$8"
          h="$8"
          borderRadius="$2"
          bg={isCurrent ? '$bgSuccessStrong' : '$bgStrong'}
          alignItems="center"
          justifyContent="center"
        >
          {isCurrent ? (
            <Icon name="CheckRadioSolid" size="$4.5" color="$iconInverse" />
          ) : (
            <SizableText size="$bodySmMedium" color="$text">
              {item.version.split('.')[0]}
            </SizableText>
          )}
        </Stack>
        <YStack>
          <XStack alignItems="center" gap="$1.5">
            <SizableText size="$bodyMdMedium">{`v${item.version}`}</SizableText>
            {isCurrent ? (
              <Badge badgeType="success" badgeSize="sm">
                <Badge.Text>Current</Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          <SizableText size="$bodyXs" color="$textSubdued">
            {`${item.bundleCount} bundle${item.bundleCount !== 1 ? 's' : ''} available`}
          </SizableText>
        </YStack>
      </XStack>
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

type ISearchResult = {
  version: string;
  bundle: IBundleInfo;
};

export default function SettingDevBundleVersionList() {
  const navigation = useAppNavigation();
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<IVersionInfo[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ISearchResult[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [gpgSkipped, setGpgSkipped] = useState(false);
  const [skipGpgVerificationAllowed, setSkipGpgVerificationAllowed] =
    useState(false);
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const searchIdRef = useRef(0);

  const currentAppVersion = String(platformEnv.version);
  const currentBundleVersion = String(platformEnv.bundleVersion);
  const currentCommitHash = normalizeCommitHash(platformEnv.githubSHA);

  useEffect(() => {
    void (async () => {
      try {
        const [versionData, skipGpg, isSkipAllowed] = await Promise.all([
          backgroundApiProxy.serviceAppUpdate.devFetchBundleVersions(),
          backgroundApiProxy.serviceDevSetting.getSkipBundleGPGVerification(),
          BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false),
        ]);
        setVersions(versionData);
        setGpgSkipped(skipGpg);
        setSkipGpgVerificationAllowed(Boolean(isSkipAllowed));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    const trimmed = text.trim();
    if (!trimmed) {
      searchIdRef.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;
    setSearching(true);
    void (async () => {
      try {
        const results =
          await backgroundApiProxy.serviceAppUpdate.devSearchBundleByCommit(
            trimmed,
          );
        if (currentSearchId !== searchIdRef.current) return;
        setSearchResults(results);

        // Check which bundles are already downloaded
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
  }, []);

  const handleDownloadStart = useCallback(() => {
    setIsDownloading(true);
  }, []);

  const handleDownloadEnd = useCallback(() => {
    setIsDownloading(false);
  }, []);

  const { currentVersion, otherVersions } = useMemo(() => {
    const current = versions.find((v) => v.version === currentAppVersion);
    const others = versions.filter((v) => v.version !== currentAppVersion);
    return { currentVersion: current, otherVersions: others };
  }, [versions, currentAppVersion]);

  const handlePress = useCallback(
    (version: string) => {
      navigation.push(EModalSettingRoutes.SettingDevBundleList, { version });
    },
    [navigation],
  );

  const isSearching = searchText.trim().length > 0;

  return (
    <Page scrollEnabled>
      <Page.Header title="Remote Bundles" />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack px="$5" py="$4" gap="$4">
            {/* Search bar */}
            <SearchBar
              placeholder="Search by commit hash"
              onSearchTextChange={handleSearch}
            />

            {/* Search results */}
            {isSearching ? (
              <YStack gap="$1.5">
                {searching ? (
                  <Stack py="$10" justifyContent="center" alignItems="center">
                    <Spinner size="large" />
                  </Stack>
                ) : null}
                {!searching && searchResults.length > 0 ? (
                  <>
                    <SizableText size="$bodyXs" color="$textSubdued" px="$1">
                      {`${searchResults.length} RESULT${searchResults.length !== 1 ? 'S' : ''}`}
                    </SizableText>
                    {searchResults.map((result) => (
                      <YStack
                        key={`${result.version}-${result.bundle.ciBundleVersion}`}
                        gap="$1"
                      >
                        <SizableText
                          size="$bodyXs"
                          color="$textSubdued"
                          px="$1"
                        >
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
                            isCurrentBundle={(() => {
                              if (result.version !== currentAppVersion) {
                                return false;
                              }
                              if (skipGpgVerificationAllowed) {
                                const bundleCommitHash = normalizeCommitHash(
                                  result.bundle.commitHash,
                                );
                                if (bundleCommitHash && currentCommitHash) {
                                  return bundleCommitHash === currentCommitHash;
                                }
                              }
                              return (
                                result.bundle.ciBundleVersion ===
                                currentBundleVersion
                              );
                            })()}
                            alreadyDownloaded={downloadedSet.has(
                              `${result.version}:${result.bundle.ciBundleVersion}`,
                            )}
                            isDownloading={isDownloading}
                            onDownloadStart={handleDownloadStart}
                            onDownloadEnd={handleDownloadEnd}
                            gpgSkipped={gpgSkipped}
                            skipGpgVerificationAllowed={
                              skipGpgVerificationAllowed
                            }
                          />
                        </YStack>
                      </YStack>
                    ))}
                  </>
                ) : null}
                {!searching && searchResults.length === 0 ? (
                  <YStack py="$10" alignItems="center" gap="$2">
                    <Icon
                      name="SearchOutline"
                      size="$10"
                      color="$iconDisabled"
                    />
                    <SizableText color="$textDisabled">
                      No bundles found
                    </SizableText>
                  </YStack>
                ) : null}
              </YStack>
            ) : (
              <>
                {/* Current version - pinned to top */}
                {currentVersion ? (
                  <YStack gap="$1.5">
                    <SizableText size="$bodyXs" color="$textSubdued" px="$1">
                      CURRENT VERSION
                    </SizableText>
                    <YStack
                      bg="$bgSubdued"
                      borderRadius="$3"
                      borderWidth={StyleSheet.hairlineWidth}
                      borderColor="$borderSuccess"
                      overflow="hidden"
                    >
                      <VersionRow
                        item={currentVersion}
                        isCurrent
                        onPress={() => handlePress(currentVersion.version)}
                      />
                    </YStack>
                  </YStack>
                ) : null}

                {/* Other versions */}
                {otherVersions.length > 0 ? (
                  <YStack gap="$1.5">
                    <SizableText size="$bodyXs" color="$textSubdued" px="$1">
                      OTHER VERSIONS
                    </SizableText>
                    <YStack
                      bg="$bgSubdued"
                      borderRadius="$3"
                      borderWidth={StyleSheet.hairlineWidth}
                      borderColor="$neutral3"
                      overflow="hidden"
                    >
                      {otherVersions.map((item, index) => (
                        <YStack key={item.version}>
                          {index > 0 ? (
                            <XStack mx="$4">
                              <Divider />
                            </XStack>
                          ) : null}
                          <VersionRow
                            item={item}
                            isCurrent={false}
                            onPress={() => handlePress(item.version)}
                          />
                        </YStack>
                      ))}
                    </YStack>
                  </YStack>
                ) : null}

                {versions.length === 0 ? (
                  <YStack py="$10" alignItems="center" gap="$2">
                    <Icon
                      name="InboxOutline"
                      size="$10"
                      color="$iconDisabled"
                    />
                    <SizableText color="$textDisabled">
                      No versions available
                    </SizableText>
                  </YStack>
                ) : null}
              </>
            )}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
