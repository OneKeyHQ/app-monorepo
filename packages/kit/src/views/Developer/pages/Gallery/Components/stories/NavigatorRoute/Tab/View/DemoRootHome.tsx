import { useCallback, useLayoutEffect } from 'react';

import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { EDemoHomeTabRoutes } from '../Routes';

import type { IDemoHomeTabParamList } from '../RouteParamTypes';

const DemoRootHome = () => {
  const navigation =
    useDemoAppNavigation<IPageNavigationProp<IDemoHomeTabParamList>>();

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
          focusVisibleStyle={{
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineColor: '$focusRing',
          }}
          borderRadius="$2"
          onPress={() => {
            console.log('onPress Row');
          }}
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
      ]}
    />
  );
};

export default DemoRootHome;
