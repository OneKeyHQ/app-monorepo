import { useNavigation } from '@react-navigation/native';

import { Button } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { DemoCreateModalRoutes, RootModalRoutes } from '../../Modal/Routes';
import { DemoRootRoutes } from '../../Routes';

import type { GlobalRouteParams } from '../../RouteParamTypes';
import type { NavigationProp } from '@react-navigation/native';

const DemoRootHome = () => {
  const navigation = useNavigation<NavigationProp<GlobalRouteParams>>();
  return (
    <Layout
      description="这是一个路由 Modal Header 的演示"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[]}
      elements={[
        {
          title: '打开 Modal',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.navigate(DemoRootRoutes.Modal, {
                  screen: DemoCreateModalRoutes.DemoCreateModal,
                });
              }}
            >
              <Button.Text>跳转 Demo</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHome;
