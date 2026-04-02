import { useRoute } from '@react-navigation/core';

import { Button, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { EDemoDeveloperTabRoutes } from '../Routes';

import type { IDemoDeveloperTabParamList } from '../RouteParamTypes';
import type { RouteProp } from '@react-navigation/core';

const DemoRootDeveloperOptions = () => {
  const navigation =
    useDemoAppNavigation<IPageNavigationProp<IDemoDeveloperTabParamList>>();
  const route = useRoute<RouteProp<IDemoDeveloperTabParamList>>();

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
                navigation.push(EDemoDeveloperTabRoutes.DemoRootDeveloper);
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
                      key: EDemoDeveloperTabRoutes.DemoRootDeveloper,
                      name: EDemoDeveloperTabRoutes.DemoRootDeveloper,
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
