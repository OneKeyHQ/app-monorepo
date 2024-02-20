import type { ReactNode } from 'react';
import { useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Page,
  ScrollView,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { useMeasureTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useCookie from '../../../hooks/useCookie';
import { ETabDeveloperRoutes, type ITabDeveloperParamList } from '../type';

const useStorage = platformEnv.isNative
  ? (key: EAppSettingKey, initialValue?: boolean) => {
      const [data, setData] = useState(
        initialValue || appStorage.getSettingBoolean(key),
      );
      const setNewData = (value: boolean) => {
        appStorage.setSetting(key, value);
        setData(value);
      };
      return [data, setNewData];
    }
  : useCookie;

function PartContainer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack>
      <Stack paddingTop="$5" paddingBottom="$2.5">
        <SizableText size="$headingMd">{title}</SizableText>
      </Stack>

      <YStack
        padding="$2.5"
        gap="$5"
        borderColor="$border"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$2"
      >
        {children}
      </YStack>
    </YStack>
  );
}

function StartTimePanel() {
  const { jsBundleLoadedTime, fpTime } = useMeasureTime();
  return (
    <PartContainer title="Startup Time(ms)">
      <SizableText>Load Time: {jsBundleLoadedTime}</SizableText>
      <SizableText>Render time: {fpTime - jsBundleLoadedTime}</SizableText>
      <SizableText>Startup Time: {fpTime}</SizableText>
    </PartContainer>
  );
}

const TabDeveloper = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabDeveloperParamList>>();

  // @ts-expect-error
  const [rrtStatus, changeRRTStatus] = useStorage(EAppSettingKey.rrt);

  return (
    <Page>
      <Page.Body>
        <ScrollView
          flex={1}
          width="100%"
          paddingHorizontal="$5"
          paddingBottom="$5"
          gap="$5"
        >
          <PartContainer title="Components">
            <Button
              onPress={() => {
                navigation.push(ETabDeveloperRoutes.ComponentsGallery);
              }}
            >
              Gallery
            </Button>
          </PartContainer>

          <PartContainer title="Debug Router & Tabs & List">
            <Button
              onPress={() => {
                navigation.push(ETabDeveloperRoutes.DevHome);
              }}
            >
              DevHome Page
            </Button>
          </PartContainer>

          <PartContainer title="Debug Tools">
            <Button
              onPress={() => {
                if (platformEnv.isNative) {
                  (changeRRTStatus as (value: boolean) => void)(!rrtStatus);
                  alert('Please manually restart the app.');
                } else {
                  const status = rrtStatus === '1' ? '0' : '1';
                  (changeRRTStatus as (value: string) => void)(status);
                  if (platformEnv.isRuntimeBrowser) {
                    if (status === '0') {
                      localStorage.removeItem(
                        '$$OnekeyReactRenderTrackerEnabled',
                      );
                    } else {
                      localStorage.setItem(
                        '$$OnekeyReactRenderTrackerEnabled',
                        'true',
                      );
                    }
                  }
                  window.location.reload();
                }
              }}
            >
              {platformEnv.isNative ? (
                <>
                  {rrtStatus
                    ? 'Disabled react-render-tracker'
                    : 'Enabled react-render-tracker'}
                </>
              ) : (
                <>
                  {rrtStatus === '1'
                    ? 'Disabled react-render-tracker'
                    : 'Enabled react-render-tracker'}
                </>
              )}
            </Button>
          </PartContainer>

          <PartContainer title="Commit Hash">
            <SizableText>{process.env.COMMITHASH}</SizableText>
          </PartContainer>

          <PartContainer title="Commit Hash">
            <Button
              onPress={async () => {
                const { test } = await import('./asyncImportTest');
                test();
              }}
            >
              Async Import Test
            </Button>
          </PartContainer>
          <StartTimePanel />
        </ScrollView>
      </Page.Body>
    </Page>
  );
};

export default TabDeveloper;
