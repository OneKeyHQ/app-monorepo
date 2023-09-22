/* eslint-disable react/no-unstable-nested-components */
import { useLayoutEffect } from 'react';

import { Button } from '@onekeyhq/components';
import {
  createStackNavigator,
  makeModalStackNavigatorOptions,
} from '@onekeyhq/components/src/Navigation';
import HeaderButtonGroup from '@onekeyhq/components/src/Navigation/Header/HeaderButtonGroup';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';
import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';
import type { ModalRoutesType } from '@onekeyhq/kit/src/routes/Root/Modal/types';

import { Layout } from '../../utils/Layout';

import { DemoCreateModalRoutes } from './types';

import type { StackScreenProps } from '@react-navigation/stack';

export type DemoCreateModalRoutesParams = {
  [DemoCreateModalRoutes.DemoCreateModal]: undefined;
  [DemoCreateModalRoutes.DemoCreateSearchModal]: undefined;
  [DemoCreateModalRoutes.DemoCreateOptionsModal]: undefined;
};

const DemoCreateModalNavigator =
  createStackNavigator<DemoCreateModalRoutesParams>();

function DemoCreateViewModal({
  navigation,
}: StackScreenProps<DemoCreateModalRoutesParams>) {
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
}: StackScreenProps<DemoCreateModalRoutesParams>) {
  console.log('DemoCreateSearchModal');

  useLayoutEffect(() => {
    navigation.setOptions({
      // @ts-expect-error
      headerSearchBarOptions: {
        headerTransparent: false,
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
}: StackScreenProps<DemoCreateModalRoutesParams>) {
  console.log('DemoCreateOptionsModal');

  useLayoutEffect(() => {
    navigation.setOptions({
      // @ts-expect-error
      headerSearchBarOptions: {
        headerTransparent: false,
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

const modalRoutes: ModalRoutesType<DemoCreateModalRoutes> = [
  {
    name: DemoCreateModalRoutes.DemoCreateModal,
    component: DemoCreateViewModal,
  },
  {
    name: DemoCreateModalRoutes.DemoCreateSearchModal,
    component: DemoCreateSearchModal,
  },
  {
    name: DemoCreateModalRoutes.DemoCreateOptionsModal,
    component: DemoCreateOptionsModal,
  },
];

const DemoCreateModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <DemoCreateModalNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...makeModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <DemoCreateModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DemoCreateModalNavigator.Navigator>
  );
};
export default DemoCreateModalStack;
