import { useRoute } from '@react-navigation/core';

import { Button } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import { Layout } from '../../../utils/Layout';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoDeveloperTabRoutes } from '../Routes';

import type { DemoDeveloperTabParamList } from '../RouteParamTypes';
import type { RouteProp } from '@react-navigation/core';

const DemoRootDeveloperOptions = () => {
  const navigation =
    useDemoAppNavigation<PageNavigationProp<DemoDeveloperTabParamList>>();
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
              buttonVariant="primary"
              onPress={() => {
                navigation.push(DemoDeveloperTabRoutes.DemoRootDeveloper);
              }}
            >
              <Button.Text>打开 Dev 页面</Button.Text>
            </Button>
          ),
        },
        {
          title: 'Reset 到 Dev 页面',
          element: (
            <Button
              buttonVariant="primary"
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
              <Button.Text>Reset Dev 页面</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootDeveloperOptions;
