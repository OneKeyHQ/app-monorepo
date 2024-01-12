import { useCallback, useLayoutEffect, useState } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { Layout } from '../../utils/Layout';
import { NavigationFocusTools } from '../../utils/NavigationTools';
import { FreezeProbe } from '../../utils/RenderTools';
import useDemoAppNavigation from '../useDemoAppNavigation';

import { EDemoLockedModalRoutes, ERootModalRoutes } from './Routes';

import type { IDemoLockedModalParamList } from './Routes';

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
        '可以 Locked 的屏幕一定要在配置里写清楚 allowDisableClose: true，否则 disableClose 属性无效',
        'Locked 的 Modal 没有办法保持屏幕常亮，如果有需求需要单独处理',
        '如果前面有被 Locked 的 Modal，跳转到同级别 Stack 的其他 Modal，返回键会消失，除非将前面 Locked 的 Modal 取消锁定',
      ]}
      elements={[
        {
          title: '开始 Demo',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoLockedModal, {
                  screen: EDemoLockedModalRoutes.DemoConfigLockedModal,
                });
              }}
            >
              开始 Demo
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoLockedViewModal" />
              <NavigationFocusTools componentName="DemoLockedViewModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

const DemoConfigLockedViewModal = () => {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoLockedModalParamList>>();

  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerRightCall,
    });
  }, [navigation, headerRightCall]);

  return (
    <Layout
      description="这是通过配置锁定 Modal 的例子"
      suggestions={[
        '可以 Locked 的屏幕一定要在配置里写清楚 allowDisableClose: true，否则 disableClose 属性无效',
        '配置 IModalFlowNavigatorConfig 的时候，在相关页面下配置 disableClose: true 即可',
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
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoLockedModal, {
                  screen: EDemoLockedModalRoutes.DemoManualLockedViewModal,
                });
              }}
            >
              下一个例子
            </Button>
          ),
        },
        {
          title: '取消锁定',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: false,
                });
              }}
            >
              取消锁定
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoConfigLockedViewModal" />
              <NavigationFocusTools componentName="DemoConfigLockedViewModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

const DemoManualLockedViewModal = () => {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoLockedModalParamList>>();

  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerRightCall,
    });
  }, [navigation, headerRightCall]);

  return (
    <Layout
      description="这是手动锁定和解锁 Modal 的例子"
      suggestions={['使用方式设置 navigation.setOptions disableClose 属性']}
      boundaryConditions={[
        '可以 Locked 的屏幕一定要在配置里写清楚 allowDisableClose: true，否则 disableClose 属性无效',
        '锁定: navigation.setOptions({\n' +
          '                  disableClose: true,\n' +
          '                });',
        '取消锁定: navigation.setOptions({\n' +
          '                  disableClose: false,\n' +
          '                });',
      ]}
      elements={[
        {
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoLockedModal, {
                  screen:
                    EDemoLockedModalRoutes.DemoRepeatManualLockedViewModal,
                });
              }}
            >
              下一个例子
            </Button>
          ),
        },
        {
          title: '锁定',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: true,
                });
              }}
            >
              锁定
            </Button>
          ),
        },
        {
          title: '取消锁定',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.setOptions({
                  disableClose: false,
                });
              }}
            >
              取消锁定
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoManualLockedViewModal" />
              <NavigationFocusTools componentName="DemoManualLockedViewModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

const DemoRepeatManualLockedViewModal = () => {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoLockedModalParamList>>();
  const [locked, setLocked] = useState(true);

  const headerRightCall = useCallback(
    () => <HeaderIconButton icon="AnonymousHidden2Outline" />,
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerRightCall,
      disableClose: locked,
    });
  }, [navigation, headerRightCall, locked]);

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
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(ERootModalRoutes.DemoLockedModal, {
                  screen:
                    EDemoLockedModalRoutes.DemoShouldPopOnClickBackdropViewModal,
                });
              }}
            >
              下一个例子
            </Button>
          ),
        },
        {
          title: '切换锁定',
          element: (
            <Button
              onPress={() => {
                setLocked((pre) => !pre);
              }}
            >
              切换锁定
            </Button>
          ),
        },
        {
          title: '关闭',
          element: (
            <Button variant="primary" onPress={navigation.popStack}>
              关闭
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRepeatManualLockedViewModal" />
              <NavigationFocusTools componentName="DemoRepeatManualLockedViewModal" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

const DemoShouldPopOnClickBackdropViewModal = () => {
  const navigation =
    useDemoAppNavigation<IModalNavigationProp<IDemoLockedModalParamList>>();
  const [shouldPopOnClickBackdrop, setShouldPopOnClickBackdrop] =
    useState(true);
  useLayoutEffect(() => {
    navigation.setOptions({
      shouldPopOnClickBackdrop,
    });
  }, [navigation, shouldPopOnClickBackdrop]);

  return (
    <Layout
      description="这是 shouldPopOnClickBackdrop 的使用例子"
      suggestions={[
        '设置 navigation.setOptions shouldPopOnClickBackdrop属性, 然后点击 Modal 的背景测试不同的效果',
      ]}
      boundaryConditions={[
        '点击 Modal 背景时返回上一页: navigation.setOptions({\n' +
          '                  shouldPopOnClickBackdrop: true,\n' +
          '                });',
        '点击 Modal 背景时退出整个 Modal: navigation.setOptions({\n' +
          '                  shouldPopOnClickBackdrop: false,\n' +
          '                });',
      ]}
      elements={[
        {
          title: `当前为: 点击 Modal 背景时${
            shouldPopOnClickBackdrop ? '返回上一页' : '退出整个 Modal'
          }`,
          element: (
            <Button
              variant="primary"
              onPress={() => {
                setShouldPopOnClickBackdrop(!shouldPopOnClickBackdrop);
              }}
            >
              切换为点击 Modal 背景时{' '}
              {shouldPopOnClickBackdrop ? '退出整个 Modal' : '返回上一页'}
            </Button>
          ),
        },
      ]}
    />
  );
};

export const LockedModalStack: IModalFlowNavigatorConfig<
  EDemoLockedModalRoutes,
  IDemoLockedModalParamList
>[] = [
  {
    name: EDemoLockedModalRoutes.DemoLockedModal,
    component: DemoLockedViewModal,
    translationId: 'Locked Modal Demo',
  },
  {
    name: EDemoLockedModalRoutes.DemoConfigLockedModal,
    component: DemoConfigLockedViewModal,
    translationId: 'Config Locked Modal',
    allowDisableClose: true,
    disableClose: true,
  },
  {
    name: EDemoLockedModalRoutes.DemoManualLockedViewModal,
    component: DemoManualLockedViewModal,
    translationId: 'Manual Locked Modal',
    allowDisableClose: true,
  },
  {
    name: EDemoLockedModalRoutes.DemoRepeatManualLockedViewModal,
    component: DemoRepeatManualLockedViewModal,
    translationId: 'Repeat Manual Locked Modal',
    allowDisableClose: true,
  },
  {
    name: EDemoLockedModalRoutes.DemoShouldPopOnClickBackdropViewModal,
    component: DemoShouldPopOnClickBackdropViewModal,
    translationId: 'Should Pop On Click Backdrop Of Modal',
    shouldPopOnClickBackdrop: true,
  },
];
