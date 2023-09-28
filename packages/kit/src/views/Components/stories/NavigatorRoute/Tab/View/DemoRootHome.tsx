import { NavigationProp, useNavigation } from '@react-navigation/native';

import { Button, YStack } from '@onekeyhq/components';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';

import { Layout } from '../../../utils/Layout';
import { DemoMainRoutes, DemoRootRoutes } from '../../Routes';
import { GlobalRouteParams } from '../../RouteParamTypes';
import { DemoHomeTabRoutes, DemoTabRoutes } from '../Routes';
import { TabStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

const DemoRootHome = () => {
  const navigation = useNavigation<NavigationProp<GlobalRouteParams>>();
  return (
    <Layout
      description="这是一个路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={[
        'BackButton 已经处理好了相关内容，所以不支持自定义 headerLeft 组件',
        '为了不破坏 Navigation 默认行为，只有一个 headerRight 图标可以根据官方 API 写，推荐使用 <HeaderButtonIcon> 组件，与 Icon 组件用法相同',
        '为了不破坏 Navigation 默认行为，如果是一个 headerRight 图标组需要使用 <HeaderButtonGroup> 组件，里面处理好了各种边距问题',
      ]}
      elements={[
        {
          title: 'HeaderButtonIcon 演示',
          element: (
            <YStack>
              <HeaderButtonIcon
                name="CrossedLargeOutline"
                color="$borderColorHover"
                onPress={() => {
                  alert('clicked');
                }}
              />
              <HeaderButtonIcon
                name="ChevronLeftOutline"
                onPress={() => {
                  alert('clicked');
                }}
              />
            </YStack>
          ),
        },
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.navigate(DemoHomeTabRoutes.DemoRootHomeSearch);
                // navigation.navigate(DemoRootRoutes.Main, {
                //   screen: DemoMainRoutes.Tab,
                //   params: {
                //     screen: DemoTabRoutes.Home,
                //     params: {
                //       screen: DemoHomeTabRoutes.DemoRootHomeSearch,
                //       // params: {
                //       //   screen: ,
                //       // },
                //     },
                //   },
                // });
              }}
            >
              <Button.Text>跳转搜索 Demo</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHome;
