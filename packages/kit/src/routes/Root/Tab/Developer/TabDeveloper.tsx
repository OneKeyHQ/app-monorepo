import type { ReactNode } from 'react';
import { useState } from 'react';

import { StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { ScrollView } from 'tamagui';

import {
  Button,
  Page,
  Stack,
  Text,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
import localDb from '@onekeyhq/kit-bg/src/dbs/local/localDb';
import { getMeasureTime } from '@onekeyhq/shared/src/modules3rdParty/react-native-metrix';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { AppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import useCookie from '../../../../hooks/useCookie';
import { setLocale, setTheme } from '../../../../store/reducers/settings';
import { GalleryRoutes } from '../../../Gallery/routes';
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
              navigation.push(RootRoutes.Gallery, {
                screen: GalleryRoutes.Components,
                params: {
                  ts: new Date().getTime(),
                },
              });
            }}
          >
            Gallery
          </Button>
        </PartContainer>

        <PartContainer title="Background">
          <Button
            onPress={async () => {
              const r = await backgroundApiProxy.servicePromise.testHelloWorld(
                'jack',
              );
              Toast.success({
                title: r,
                message: r,
              });
              console.log('testHelloWorld > ', r);
              await backgroundApiProxy.servicePromise.testHelloWorld('jack');
              void backgroundApiProxy.servicePromise.testHelloWorld2('jack');
            }}
          >
            Test service
          </Button>
        </PartContainer>

        <PartContainer title="DB">
          <Button
            onPress={async () => {
              const ctx = await localDb.getContext();
              // @ts-ignore
              window.$$localDb = localDb;
              console.log(ctx);
            }}
          >
            Show Context
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
              Light Theme
            </Button>
            <Button
              flex={1}
              variant="primary"
              onPress={() => {
                dispatch(setTheme('dark'));
              }}
            >
              Night Theme
            </Button>
          </XStack>
          <XStack gap="$4" display="flex" justifyContent="center">
            <Button
              flex={1}
              onPress={() => {
                dispatch(setLocale('en-US'));
              }}
            >
              英文
            </Button>
            <Button
              flex={1}
              variant="primary"
              onPress={() => {
                dispatch(setLocale('zh-CN'));
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
