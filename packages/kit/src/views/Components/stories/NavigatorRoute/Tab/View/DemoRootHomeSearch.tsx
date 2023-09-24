import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Button, Text } from '@onekeyhq/components';

import { Layout } from '../../../utils/Layout';
import { DemoTabChildRoutes } from '../../Routes';

import type {
  NativeSyntheticEvent,
  TextInputChangeEventData,
} from 'react-native';

const DemoRootHomeSearch = () => {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        headerTransparent: false,
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
                // @ts-expect-error
                navigation.navigate({
                  name: DemoTabChildRoutes.DemoRootHomeOptions,
                });
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
