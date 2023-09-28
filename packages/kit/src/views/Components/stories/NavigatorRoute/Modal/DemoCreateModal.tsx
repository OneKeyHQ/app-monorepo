/* eslint-disable react/no-unstable-nested-components */
import { useLayoutEffect } from 'react';

import type { StackScreenProps } from '@onekeyhq/components';
import { Button } from '@onekeyhq/components';
import HeaderButtonGroup from '@onekeyhq/components/src/Navigation/Header/HeaderButtonGroup';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator/ModalFlowNavigator';

import { Layout } from '../../utils/Layout';

import { DemoCreateModalRoutes } from './RootModalRoutes';

export type DemoCreateModalParamList = {
  [DemoCreateModalRoutes.DemoCreateModal]: undefined;
  [DemoCreateModalRoutes.DemoCreateSearchModal]: undefined;
  [DemoCreateModalRoutes.DemoCreateOptionsModal]: undefined;
};

function DemoCreateViewModal({
  navigation,
}: StackScreenProps<DemoCreateModalParamList>) {
  console.log('DemoCreateViewModal');
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButtonIcon name="AnonymousHidden2Outline" />,
    });
  }, [navigation]);

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
                  DemoCreateModalRoutes.DemoCreateSearchModal,
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
}: StackScreenProps<DemoCreateModalParamList>) {
  console.log('DemoCreateSearchModal');

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
}: StackScreenProps<DemoCreateModalParamList>) {
  console.log('DemoCreateOptionsModal');

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
];
