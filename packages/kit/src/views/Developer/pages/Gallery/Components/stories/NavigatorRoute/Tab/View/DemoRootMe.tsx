import { Button, SizableText, Stack } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { EDemoDeveloperTabRoutes, EDemoTabRoutes } from '../Routes';

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
              variant="primary"
              onPress={() => {
                navigation.switchTab(EDemoTabRoutes.Home);
              }}
            >
              跳转 Home
            </Button>
          ),
        },
        {
          title: '切换到 Developer Tab 的第二个页面',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.switchTab(EDemoTabRoutes.Developer, {
                  screen: EDemoDeveloperTabRoutes.DemoRootDeveloperOptions,
                  params: {
                    from: '来自 Me Tab 页面的跳转',
                  },
                });
              }}
            >
              跳转 Developer
            </Button>
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
        {
          title: 'BottomTab 渲染卡顿测试',
          element: (
            <Stack>
              {new Array(1000).fill({}).map((_, index) => (
                <SizableText>
                  这是有1000个 View 的 BottomTab 卡顿测试{index}
                </SizableText>
              ))}
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootMe;
