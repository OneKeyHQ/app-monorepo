import { useLayoutEffect } from 'react';

import { Button } from '@onekeyhq/components';
import type { ModalNavigationProp } from '@onekeyhq/components/src/Navigation';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';
import type { ModalFlowNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';

import { Layout } from '../../utils/Layout';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { DemoLockedModalRoutes, RootModalRoutes } from './Routes';

import type { DemoLockedModalParamList } from './Routes';

const DemoLockedViewModal = () => {
  const navigation = useDemoAppNavigation();

  return (
    <Layout
      description="这是 Locked Modal 的演示"
      suggestions={[
        'Locked 的 Modal 无法通过点击空白处关闭',
        'Locked 的 Modal 无法通过点击返回键关闭',
        'Locked 的 Modal 左上角关闭按钮会隐藏',
        'Locked 的 Modal 在 iOS 平台无法向下滑动关闭 Modal',
        'Locked 的 Modal 在 iOS 平台显示的 Modal 回事堆叠样式',
        'Locked 的 Modal 可以通过代码取消锁定或者关闭',
      ]}
      boundaryConditions={[
        'Locked 的 Modal 没有办法保持屏幕常亮，如果有需求需要单独处理',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoLockedModal, {
                  screen: DemoLockedModalRoutes.DemoConfigLockedModal,
                });
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

const DemoConfigLockedViewModal = () => {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoLockedModalParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButtonIcon name="AnonymousHidden2Outline" />,
    });
  }, [navigation]);

  return (
    <Layout
      description="这是通过配置锁定 Modal 的例子"
      suggestions={[
        '配置 ModalFlowNavigatorConfig 的时候，在相关页面下配置 disableClose: true 即可',
        '同样可以手动取消锁定',
      ]}
      boundaryConditions={[
        '取消锁定: navigation.setOptions({\n' +
          '                  disableClose: false,\n' +
          '                });',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoLockedModal, {
                  screen: DemoLockedModalRoutes.DemoManualLockedViewModal,
                });
              }}
            >
              <Button.Text>下一个例子</Button.Text>
            </Button>
          ),
        },
        {
          title: '取消锁定',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: false,
                });
              }}
            >
              <Button.Text>取消锁定</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

const DemoManualLockedViewModal = () => {
  const navigation =
    useDemoAppNavigation<ModalNavigationProp<DemoLockedModalParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderButtonIcon name="AnonymousHidden2Outline" />,
    });
  }, [navigation]);

  return (
    <Layout
      description="这是手动锁定和解锁 Modal 的例子"
      suggestions={['使用方式设置 navigation.setOptions disableClose 属性']}
      boundaryConditions={[
        '锁定: navigation.setOptions({\n' +
          '                  disableClose: true,\n' +
          '                });',
        '取消锁定: navigation.setOptions({\n' +
          '                  disableClose: false,\n' +
          '                });',
      ]}
      elements={[
        {
          title: '锁定',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: true,
                });
              }}
            >
              <Button.Text>锁定</Button.Text>
            </Button>
          ),
        },
        {
          title: '取消锁定',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: false,
                });
              }}
            >
              <Button.Text>取消锁定</Button.Text>
            </Button>
          ),
        },
        {
          title: '关闭',
          element: (
            <Button buttonVariant="primary" onPress={navigation.popStack}>
              <Button.Text>关闭</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export const LockedModalStack: ModalFlowNavigatorConfig<
  DemoLockedModalRoutes,
  DemoLockedModalParamList
>[] = [
  {
    name: DemoLockedModalRoutes.DemoLockedModal,
    component: DemoLockedViewModal,
    translationId: 'Modal Done',
  },
  {
    name: DemoLockedModalRoutes.DemoConfigLockedModal,
    component: DemoConfigLockedViewModal,
    translationId: 'Locked Modal',
    disableClose: true,
  },
  {
    name: DemoLockedModalRoutes.DemoManualLockedViewModal,
    component: DemoManualLockedViewModal,
    translationId: 'Manual Locked Modal',
  },
];
