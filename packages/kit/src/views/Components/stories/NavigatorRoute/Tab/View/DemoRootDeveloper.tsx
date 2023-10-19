import { Input } from 'tamagui';

import { Button, Stack } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import { DemoCreateModalRoutes, RootModalRoutes } from '../../Modal/Routes';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoDeveloperTabRoutes } from '../Routes';

const DemoRootDeveloper = () => {
  const navigation = useDemoAppNavigation();

  return (
    <Layout
      description="这是一个关于路由 Modal 的相关演示"
      suggestions={[]}
      boundaryConditions={[]}
      elements={[
        {
          title: '输入文字测试冻结',
          element: <Input />,
        },
        {
          title: '打开 Developer 下一个页面',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.push(
                  DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
                  {
                    from: '来自 Developer Tab 页面的跳转',
                  },
                );
              }}
            >
              下一个页面
            </Button>
          ),
        },
        {
          title: '这是一个 Modal 的演示',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCreateModal, {
                  screen: DemoCreateModalRoutes.DemoCreateModal,
                  params: {
                    question: '你好',
                  },
                });
              }}
            >
              打开 Modal Demo
            </Button>
          ),
        },
        {
          title: '这是一个可以锁定的 Modal 的演示',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoLockedModal);
              }}
            >
              打开 Modal Demo
            </Button>
          ),
        },
        {
          title: '打开 Modal (Big List Demo)',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCreateModal, {
                  screen: DemoCreateModalRoutes.DemoBigListModal,
                });
              }}
            >
              打开 Modal Demo
            </Button>
          ),
        },
        {
          title: 'Modal 覆盖测试',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCoverageModal);
              }}
            >
              打开 Modal Demo
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootDeveloper" />
              <NavigationFocusTools componentName="DemoRootDeveloper" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootDeveloper;
