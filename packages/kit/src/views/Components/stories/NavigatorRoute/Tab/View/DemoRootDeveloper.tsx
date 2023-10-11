import { Input } from 'tamagui';

import { Button } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { DemoCreateModalRoutes, RootModalRoutes } from '../../Modal/Routes';
import { useFreezeProbe } from '../../RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoDeveloperTabRoutes } from '../Routes';

const DemoRootDeveloper = () => {
  const navigation = useDemoAppNavigation();
  useFreezeProbe('DemoRootDeveloper');
  return (
    <Layout
      description="这是一个路由 Modal 的演示"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[]}
      elements={[
        {
          title: '冻结测试',
          element: <Input />,
        },
        {
          title: '打开 Developer 下一个页面',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.push(
                  DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
                  {
                    from: '来自 Developer Tab 页面的跳转',
                  },
                );
              }}
            >
              <Button.Text>下一个页面</Button.Text>
            </Button>
          ),
        },
        {
          title: '这是一个 Modal 的演示',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCreateModal, {
                  screen: DemoCreateModalRoutes.DemoCreateModal,
                  params: {
                    question: '你好',
                  },
                });
              }}
            >
              <Button.Text>打开 Modal</Button.Text>
            </Button>
          ),
        },
        {
          title: '这是一个可以锁定的 Modal 的演示',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoLockedModal);
              }}
            >
              <Button.Text>打开 Modal</Button.Text>
            </Button>
          ),
        },
        {
          title: '打开 Modal (Big List Demo)',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.pushModal(RootModalRoutes.DemoCreateModal, {
                  screen: DemoCreateModalRoutes.DemoBigListModal,
                });
              }}
            >
              <Button.Text>打开 Modal</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootDeveloper;
