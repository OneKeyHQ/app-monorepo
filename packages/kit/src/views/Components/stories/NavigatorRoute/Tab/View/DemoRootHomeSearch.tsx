import { useLayoutEffect } from 'react';

import { Button, Text } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import { Layout } from '../../../utils/Layout';
import { useFreezeProbe } from '../../RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { DemoHomeTabRoutes } from '../Routes';

import type { DemoHomeTabParamList } from '../RouteParamTypes';
import type {
  NativeSyntheticEvent,
  TextInputChangeEventData,
} from 'react-native';

const DemoRootHomeSearch = () => {
  const navigation =
    useDemoAppNavigation<PageNavigationProp<DemoHomeTabParamList>>();

  useFreezeProbe('DemoRootHomeSearch');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: '搜索',
        inputType: 'text',
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          console.log('onChangeText', event.nativeEvent.text),
      },
    });
  }, [navigation]);

  return (
    <Layout
      description="这是一个带搜索的路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={['无']}
      elements={[
        {
          title: '使用说明',
          element: (
            <Text variant="$bodyLg">{`这是一个简单的使用场景
            useLayoutEffect(() => {
              navigation.setOptions({
                headerSearchBarOptions: {
                  placeholder: '搜索',
                  inputType: 'text',
                  onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
                    console.log(event.nativeEvent.text),
                },
              });
            }, []);
          `}</Text>
          ),
        },
        {
          title: '下一个例子',
          element: (
            <Button
              buttonVariant="primary"
              onPress={() => {
                navigation.push(DemoHomeTabRoutes.DemoRootHomeOptions);
              }}
            >
              <Button.Text>跳转自定义 headerRight Demo</Button.Text>
            </Button>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHomeSearch;
