import { Button } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoDeveloperTabRoutes, DemoTabRoutes } from '../Routes';

const DemoRootMe = () => {
  const navigation = useDemoAppNavigation();
  return (
    <Layout
      description="这是一个 Tab 切换演示"
      suggestions={['需要使用 useDemoAppNavigation hook 的 switchTab 方法']}
      boundaryConditions={[]}
      elements={[
        {
          title: '切换到首页',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.switchTab(DemoTabRoutes.Home);
              }}
            >
              <Button.Text>跳转 Home</Button.Text>
            </Button>
          ),
        },
        {
          title: '切换到 Developer Tab 的第二个页面',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.switchTab(DemoTabRoutes.Developer, {
                  screen: DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
                  params: {
                    from: '来自 Me Tab 页面的跳转',
                  },
                });
              }}
            >
              <Button.Text>跳转 Developer</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootMe;
