import { useNavigation } from '@react-navigation/native';

import { Button } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { DemoRootRoutes } from '../../RootRoutes';

import type { NavigationProp } from '@react-navigation/native';
import { DemoRootModalRoutes } from '../../Modal/RootModalRoutes';
import type { GlobalRouteParams } from '../../types';

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
                  screen: DemoRootModalRoutes.DemoCreateModal,
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
