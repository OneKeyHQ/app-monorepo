import { NewButton, Stack } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
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
            <NewButton
              variant="primary"
              onPress={() => {
                navigation.switchTab(DemoTabRoutes.Home);
              }}
            >
              跳转 Home
            </NewButton>
          ),
        },
        {
          title: '切换到 Developer Tab 的第二个页面',
          element: (
            <NewButton
              variant="primary"
              onPress={() => {
                navigation.switchTab(DemoTabRoutes.Developer, {
                  screen: DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
                  params: {
                    from: '来自 Me Tab 页面的跳转',
                  },
                });
              }}
            >
              跳转 Developer
            </NewButton>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootMe" />
              <NavigationFocusTools componentName="DemoRootMe" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootMe;
