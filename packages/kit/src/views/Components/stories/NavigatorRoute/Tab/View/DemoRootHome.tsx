import { Button, YStack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
import HeaderButtonIcon from '@onekeyhq/components/src/Navigation/Header/HeaderButtonIcon';

import { Layout } from '../../../utils/Layout';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoHomeTabRoutes } from '../Routes';

import type { DemoHomeTabParamList } from '../RouteParamTypes';

const DemoRootHome = () => {
  const navigation =
    useDemoAppNavigation<PageNavigationProp<DemoHomeTabParamList>>();
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
                navigation.push(DemoHomeTabRoutes.DemoRootHomeSearch);
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
