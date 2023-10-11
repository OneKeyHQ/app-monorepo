/* eslint-disable react/no-unstable-nested-components */
import { useLayoutEffect } from 'react';

import { Button, Text } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/components/src/Navigation';
import HeaderButtonGroup from '@onekeyhq/components/src/Navigation/Header/HeaderButtonGroup';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator/ModalFlowNavigator';

import IconGallery from '../../Icon';
import { Layout } from '../../utils/Layout';
import { useFreezeProbe } from '../RenderTools';

import { DemoCreateModalRoutes } from './Routes';

import type { DemoCreateModalParamList } from './Routes';

function DemoCreateViewModal({
  navigation,
}: ModalScreenProps<DemoCreateModalParamList>) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButtonIcon name="AnonymousHidden2Outline" />,
    });
  }, [navigation]);

  useFreezeProbe('DemoCreateViewModal');

  return (
    <Layout
      description="这是一个路由 Header"
      suggestions={[
        'Modal 可以通过点击空白处关闭或返回上一级',
        'Modal 可以通过按 ESC 键关闭或返回上一级',
        'Android 平台 Modal 可以通过点击返回键关闭或返回上一级',
        'iOS 平台 Modal 可以通过向下滑动直接关闭整个 Modal Stack',
      ]}
      boundaryConditions={[
        '打开 Modal 推荐使用 useDemoAppNavigation() hook 的 pushModal 方法',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.navigate(
                  DemoCreateModalRoutes.DemoCreateSearchModal,
                  {
                    question: '你好',
                  },
                );
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
}

function DemoCreateSearchModal({
  navigation,
}: ModalScreenProps<DemoCreateModalParamList>) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        onChangeText: (event: any) => {
          console.log('onChangeText', event);
        },
      },
    });
  }, [navigation]);

  useFreezeProbe('DemoCreateSearchModal');

  return (
    <Layout
      description="这是一个路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.navigate(
                  DemoCreateModalRoutes.DemoCreateOptionsModal,
                  {
                    question: '你好',
                  },
                );
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
}

function DemoCreateOptionsModal({
  navigation,
}: ModalScreenProps<DemoCreateModalParamList>) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        onChangeText: (event: any) => {
          console.log('onChangeText', event);
        },
      },
      headerRight: () => (
        <HeaderButtonGroup>
          <HeaderButtonIcon name="AnonymousHidden2Outline" />
          <HeaderButtonIcon name="ArchiveOutline" />
          <HeaderButtonIcon name="AlignmentJustifyOutline" />
        </HeaderButtonGroup>
      ),
    });
  }, [navigation]);

  useFreezeProbe('DemoCreateOptionsModal');

  return (
    <Layout
      description="这是一个路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.getParent()?.goBack?.();
              }}
            >
              <Button.Text>关闭</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
}

export const CreateModalStack: ModalFlowNavigatorConfig<
  DemoCreateModalRoutes,
  DemoCreateModalParamList
>[] = [
  {
    name: DemoCreateModalRoutes.DemoCreateModal,
    component: DemoCreateViewModal,
    translationId: 'Modal Demo',
  },
  {
    name: DemoCreateModalRoutes.DemoCreateSearchModal,
    component: DemoCreateSearchModal,
    translationId: 'Search Modal',
  },
  {
    name: DemoCreateModalRoutes.DemoCreateOptionsModal,
    component: DemoCreateOptionsModal,
    translationId: 'Options Demo Modal',
  },
  {
    name: DemoCreateModalRoutes.DemoBigListModal,
    component: IconGallery,
    translationId: 'Big List Demo Modal',
  },
];
