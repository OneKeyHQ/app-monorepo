import { useRoute } from '@react-navigation/core';

import { Button, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoDeveloperTabRoutes } from '../Routes';

import type { DemoDeveloperTabParamList } from '../RouteParamTypes';
import type { RouteProp } from '@react-navigation/core';

const DemoRootDeveloperOptions = () => {
  const navigation =
    useDemoAppNavigation<IPageNavigationProp<DemoDeveloperTabParamList>>();
  const route = useRoute<RouteProp<DemoDeveloperTabParamList>>();

  return (
    <Layout
      description="我是 Dev Tab 下面的 Options 页面"
      suggestions={[`携带的参数：${route?.params?.from ?? 'null'}`]}
      boundaryConditions={[]}
      elements={[
        {
          title: '打开 Dev 页面',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.push(DemoDeveloperTabRoutes.DemoRootDeveloper);
              }}
            >
              打开 Dev 页面
            </Button>
          ),
        },
        {
          title: 'Reset 到 Dev 页面',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [
                    {
                      key: DemoDeveloperTabRoutes.DemoRootDeveloper,
                      name: DemoDeveloperTabRoutes.DemoRootDeveloper,
                    },
                  ],
                });
              }}
            >
              Reset Dev 页面
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootDeveloperOptions" />
              <NavigationFocusTools componentName="DemoRootDeveloperOptions" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootDeveloperOptions;
