import { useCallback, useLayoutEffect, useState } from 'react';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import useCookie from '@onekeyhq/kit/src/@onekeyhq/kit/src/../hooks/useCookie';
import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { EDemoHomeTabRoutes } from '../Routes';

import type { IDemoHomeTabParamList } from '../RouteParamTypes';

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

const DemoRootHome = () => {
  const navigation =
    useDemoAppNavigation<IPageNavigationProp<IDemoHomeTabParamList>>();

  // @ts-expect-error
  const [rrtStatus, changeRRTStatus] = useStorage(EAppSettingKey.rrt);

  const renderHeaderTitle = useCallback(
    () => (
      <Stack flex={1} justifyContent="center">
        <Stack
          alignSelf="flex-start"
          focusable
          flexDirection="row"
          p="$1.5"
          m="$-1.5"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusStyle={{
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineColor: '$focusRing',
          }}
          borderRadius="$2"
        >
          <Stack
            w="$6"
            h="$6"
            borderRadius="$1"
            bg="skyblue"
            justifyContent="center"
            alignItems="center"
          >
            <SizableText size="$bodyLgMedium">🦄</SizableText>
          </Stack>
          <SizableText ml="$2" size="$bodyLgMedium" userSelect="none">
            Wallet Name
          </SizableText>
        </Stack>
      </Stack>
    ),
    [],
  );

  const renderHeaderRight = useCallback(
    () => <HeaderIconButton icon="SettingsOutline" />,
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: renderHeaderTitle,
      headerRight: renderHeaderRight,
    });
  }, [navigation, renderHeaderRight, renderHeaderTitle]);

  return (
    <Layout
      description="这是一个路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
        '为了不破坏 Navigation 默认行为，只有一个 headerRight 图标可以根据官方 API 写，推荐使用 <HeaderIconButton> 组件，与 Icon 组件用法相同',
        '为了不破坏 Navigation 默认行为，如果是一个 headerRight 图标组需要使用 <HeaderButtonGroup> 组件，里面处理好了各种边距问题',
      ]}
      elements={[
        {
          title: 'HeaderIconButton 演示',
          element: (
            <YStack>
              <HeaderIconButton
                icon="CrossedLargeOutline"
                color="$borderColorHover"
                onPress={() => {
                  alert('clicked');
                }}
              />
              <HeaderIconButton
                icon="ChevronLeftOutline"
                onPress={() => {
                  alert('clicked');
                }}
              />
            </YStack>
          ),
        },

        {
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.push(EDemoHomeTabRoutes.DemoRootHomeSearch);
              }}
            >
              跳转搜索 Demo
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootHome" />
              <NavigationFocusTools componentName="DemoRootHome" />
            </Stack>
          ),
        },
        {
          title: '开启 ReactRenderTracker',
          element: (
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
              开关 ReactRenderTracker
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHome;
