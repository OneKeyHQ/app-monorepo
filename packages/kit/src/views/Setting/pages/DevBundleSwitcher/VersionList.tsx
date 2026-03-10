import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

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

export default function SettingDevBundleVersionList() {
  const navigation = useAppNavigation();
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<IVersionInfo[]>([]);

  const currentAppVersion = String(platformEnv.version);

  useEffect(() => {
    void backgroundApiProxy.serviceAppUpdate
      .devFetchBundleVersions()
      .then(setVersions)
      .finally(() => {
        setLoading(false);
      });
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
                <Icon name="InboxOutline" size="$10" color="$iconDisabled" />
                <SizableText color="$textDisabled">
                  No versions available
                </SizableText>
              </YStack>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
