import type { ReactNode } from 'react';
import { useState } from 'react';

import { StyleSheet } from 'react-native';
import { ScrollView } from 'tamagui';

import {
  Button,
  Page,
  Stack,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import { getMeasureTime } from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { AppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import useCookie from '../../../../hooks/useCookie';

import { ETabDeveloperRoutes, type ITabDeveloperParamList } from './Routes';

function setTheme(theme: string) {
  console.log(theme);
}

function setLocale(locale: string) {
  console.log(locale);
}

const useStorage = platformEnv.isNative
  ? (key: AppSettingKey, initialValue?: boolean) => {
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
        <Text variant="$headingMd">{title}</Text>
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

const TabDeveloper = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabDeveloperParamList>>();

  // @ts-expect-error
  const [rrtStatus, changeRRTStatus] = useStorage(AppSettingKey.rrt);

  return (
    <Page>
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

        <PartContainer title="App Settings">
          <XStack gap="$4" display="flex" justifyContent="center">
            <Button
              flex={1}
              onPress={() => {
                setTheme('light');
              }}
            >
              Light Theme
            </Button>
            <Button
              flex={1}
              variant="primary"
              onPress={() => {
                setTheme('dark');
              }}
            >
              Night Theme
            </Button>
          </XStack>
          <XStack gap="$4" display="flex" justifyContent="center">
            <Button
              flex={1}
              onPress={() => {
                setLocale('en-US');
              }}
            >
              英文
            </Button>
            <Button
              flex={1}
              variant="primary"
              onPress={() => {
                setLocale('zh-CN');
              }}
            >
              中文
            </Button>
          </XStack>
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

        <PartContainer title="Cold Startup Time(ms)">
          <Text>{getMeasureTime().jsBundleLoadedTime}</Text>
        </PartContainer>
      </ScrollView>
    </Page>
  );
};

export default TabDeveloper;
