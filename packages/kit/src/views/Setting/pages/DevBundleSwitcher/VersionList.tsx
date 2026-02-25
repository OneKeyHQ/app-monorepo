import { useCallback, useEffect, useState } from 'react';

import {
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

export default function SettingDevBundleVersionList() {
  const navigation = useAppNavigation();
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<
    { version: string; bundleCount: number }[]
  >([]);

  useEffect(() => {
    void backgroundApiProxy.serviceAppUpdate
      .devFetchBundleVersions()
      .then((data) => {
        setVersions(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePress = useCallback(
    (version: string) => {
      navigation.push(EModalSettingRoutes.SettingDevBundleList, { version });
    },
    [navigation],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="JS Bundle Versions" />
      <Page.Body>
        {loading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <YStack p="$4" gap="$2">
            {versions.map((item) => (
              <Stack
                key={item.version}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                p="$3"
                borderRadius="$3"
                bg="$bgSubdued"
                pressStyle={{ bg: '$bgHover' }}
                onPress={() => handlePress(item.version)}
              >
                <YStack>
                  <SizableText size="$bodyLgMedium">{item.version}</SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {`${item.bundleCount} bundle(s)`}
                  </SizableText>
                </YStack>
                <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
              </Stack>
            ))}
            {versions.length === 0 ? (
              <SizableText color="$textSubdued" textAlign="center">
                No versions available
              </SizableText>
            ) : null}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
