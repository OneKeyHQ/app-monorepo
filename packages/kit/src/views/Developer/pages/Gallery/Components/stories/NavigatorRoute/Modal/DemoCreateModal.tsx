/* eslint-disable react/no-unstable-nested-components */
import { useEffect } from 'react';

import { Button, Input, Stack, Toast } from '@onekeyhq/components';
import type { IModalScreenProps } from '@onekeyhq/components/src/layouts/Navigation';
import HeaderButtonGroup from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderButtonGroup';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator/ModalFlowNavigator';

import IconGallery from '../../Icon';
import { Layout } from '../../utils/Layout';
import { NavigationFocusTools } from '../../utils/NavigationTools';
import { FreezeProbe } from '../../utils/RenderTools';
import { EDemoRootRoutes } from '../Routes';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { EDemoCreateModalRoutes, ERootModalRoutes } from './Routes';

import type { IDemoCreateModalParamList } from './Routes';

function DemoCreateViewModal({
  navigation,
}: IModalScreenProps<IDemoCreateModalParamList>) {
  const demoNavigation = useDemoAppNavigation();
  useEffect(() => {
    demoNavigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        hideNavigationBar: true,
        hideWhenScrolling: true,
        autoFocus: true,
        onChangeText: (event: any) => {
          console.log('onChangeText', event);
        },
      },
      headerRight: () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    });
  }, [demoNavigation]);

  return (
    <Layout
      description="这是一个普通的 Modal 测试"
      skipLoading
      suggestions={[
        'Modal 可以通过点击空白处关闭或返回上一级',
        'Modal 可以通过按 ESC 键关闭或返回上一级',
        'Android 平台 Modal 可以通过点击返回键关闭或返回上一级',
        'iOS 平台 Modal 可以通过向下滑动直接关闭整个 Modal Stack',
      ]}
      boundaryConditions={[
        '打开 Modal 推荐使用 useDemoAppNavigation() hook 的 pushModal 方法',
      ]}
      contentInsetAdjustmentBehavior="automatic"
      elements={[
        {
          title: '开始 Demo',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.navigate(
                  EDemoCreateModalRoutes.DemoCreateSearchModal,
                  {
                    question: '你好',
                  },
                );
              }}
            >
              开始 Demo
            </Button>
          ),
        },
        {
          title: '测试输入法',
          element: <Input />,
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCreateViewModal" />
              <NavigationFocusTools componentName="DemoCreateViewModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

function DemoCreateSearchModal({
  navigation,
}: IModalScreenProps<IDemoCreateModalParamList>) {
  const demoNavigation = useDemoAppNavigation();
  useEffect(() => {
    demoNavigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        hideNavigationBar: true,
        hideWhenScrolling: true,
        autoFocus: false,
        onChangeText: (event: any) => {
          console.log('onChangeText', event);
        },
      },
    });
  }, [demoNavigation]);

  return (
    <Layout
      skipLoading
      contentInsetAdjustmentBehavior="automatic"
      description="这是一个带搜索框的 Modal"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '输入文字测试冻结',
          element: <Input />,
        },
        {
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.navigate(
                  EDemoCreateModalRoutes.DemoCreateOptionsModal,
                  {
                    question: '你好',
                  },
                );
              }}
            >
              下一个例子
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCreateSearchModal" />
              <NavigationFocusTools componentName="DemoCreateSearchModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

function DemoCreateOptionsModal({
  navigation,
}: IModalScreenProps<IDemoCreateModalParamList>) {
  const demoNavigation = useDemoAppNavigation();
  useEffect(() => {
    demoNavigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        hideNavigationBar: false,
        hideWhenScrolling: true,
        autoFocus: true,
        onChangeText: (event: any) => {
          console.log('onChangeText', event);
        },
      },
      headerRight: () => (
        <HeaderButtonGroup>
          <HeaderIconButton icon="AnonymousHidden2Outline" />
          <HeaderIconButton icon="ArchiveOutline" />
          <HeaderIconButton icon="AlignmentJustifyOutline" />
        </HeaderButtonGroup>
      ),
    });
  }, [demoNavigation]);

  return (
    <Layout
      skipLoading
      contentInsetAdjustmentBehavior="automatic"
      description="这是一个带有搜索框和 RightButton 的 Demo"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '跳转到其他 Stack 的 Modal',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                // @ts-expect-error
                navigation.navigate(EDemoRootRoutes.Modal, {
                  screen: ERootModalRoutes.DemoLockedModal,
                });
              }}
            >
              跳转
            </Button>
          ),
        },
        {
          title: '关闭',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                Toast.message({
                  title: 'Close Modal',
                });
                navigation.getParent()?.goBack?.();
              }}
            >
              关闭并弹出 Toast
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoCreateOptionsModal" />
              <NavigationFocusTools componentName="DemoCreateOptionsModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
}

export const CreateModalStack: IModalFlowNavigatorConfig<
  EDemoCreateModalRoutes,
  IDemoCreateModalParamList
>[] = [
  {
    name: EDemoCreateModalRoutes.DemoCreateModal,
    component: DemoCreateViewModal,
    translationId: 'Modal Demo',
  },
  {
    name: EDemoCreateModalRoutes.DemoCreateSearchModal,
    component: DemoCreateSearchModal,
    translationId: 'Search Modal',
  },
  {
    name: EDemoCreateModalRoutes.DemoCreateOptionsModal,
    component: DemoCreateOptionsModal,
    translationId: 'Options Demo Modal',
  },
  {
    name: EDemoCreateModalRoutes.DemoBigListModal,
    component: IconGallery,
    translationId: 'Big List Demo Modal',
  },
];
