import type { ReactNode } from 'react';
import { useState } from 'react';

import { StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import useCookie from 'react-use-cookie';
import { ScrollView } from 'tamagui';

import { Button, Stack, Text, XStack, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { AppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { setLocale, setTheme } from '../../../../store/reducers/settings';
import { GalleryRoutes } from '../../../Gallery';
import { RootRoutes } from '../../Routes';

import type { TabDeveloperParamList } from './Routes';

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
    useAppNavigation<PageNavigationProp<TabDeveloperParamList>>();
  const dispatch = useDispatch();

  const [rrtStatus, changeRRTStatus] = useStorage(AppSettingKey.rrt);

  return (
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
            navigation.push(RootRoutes.Gallery, {
              screen: GalleryRoutes.Components,
              params: {
                ts: new Date().getTime(),
              },
            });
          }}
        >
          <Button.Text>Gallery</Button.Text>
        </Button>
      </PartContainer>

      <PartContainer title="App Settings">
        <XStack gap="$4" display="flex" justifyContent="center">
          <Button
            flex={1}
            onPress={() => {
              dispatch(setTheme('light'));
            }}
          >
            <Button.Text>Light Theme</Button.Text>
          </Button>
          <Button
            flex={1}
            buttonVariant="primary"
            onPress={() => {
              dispatch(setTheme('dark'));
            }}
          >
            <Button.Text>Night Theme</Button.Text>
          </Button>
        </XStack>
        <XStack gap="$4" display="flex" justifyContent="center">
          <Button
            flex={1}
            onPress={() => {
              dispatch(setLocale('en-US'));
            }}
          >
            <Button.Text>英文</Button.Text>
          </Button>
          <Button
            flex={1}
            buttonVariant="primary"
            onPress={() => {
              dispatch(setLocale('zh-CN'));
            }}
          >
            <Button.Text>中文</Button.Text>
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
                  localStorage.removeItem('$$OnekeyReactRenderTrackerEnabled');
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
            <Button.Text>
              {rrtStatus
                ? 'Disabled react-render-tracker'
                : 'Enabled react-render-tracker'}
            </Button.Text>
          ) : (
            <Button.Text>
              {rrtStatus === '1'
                ? 'Disabled react-render-tracker'
                : 'Enabled react-render-tracker'}
            </Button.Text>
          )}
        </Button>
      </PartContainer>
    </ScrollView>
  );
};

export default TabDeveloper;
