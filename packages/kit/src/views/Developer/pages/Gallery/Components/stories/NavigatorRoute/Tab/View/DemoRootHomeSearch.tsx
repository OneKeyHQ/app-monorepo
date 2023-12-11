import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import { ERootModalRoutes } from '../../Modal/Routes';
import { EDemoRootRoutes } from '../../Routes';
import useDemoAppNavigation from '../../useDemoAppNavigation';
import { EDemoHomeTabRoutes } from '../Routes';

import type { IDemoHomeTabParamList } from '../RouteParamTypes';
import type {
  NativeSyntheticEvent,
  TextInputChangeEventData,
  TextInputSubmitEditingEventData,
} from 'react-native';

const DemoRootHomeSearch = () => {
  const intl = useIntl();
  const navigation =
    useDemoAppNavigation<IPageNavigationProp<IDemoHomeTabParamList>>();

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: intl.formatMessage({
          id: 'content__search_dapps_or_type_url',
        }),
        inputType: 'text',
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          console.log('onChangeText', event.nativeEvent.text),
        onSearchButtonPress: (
          event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
        ) => console.log('onSearchButtonPress', event.nativeEvent.text),
      },
    });
  }, [navigation, intl]);

  return (
    <Layout
      skipLoading={platformEnv.isNativeIOS}
      description="这是一个带搜索的路由 Header"
      suggestions={['使用方式与 @react-navigation/native-stack 相同']}
      boundaryConditions={['无']}
      elements={[
        {
          title: '使用说明',
          element: (
            <Text variant="$bodyLg">{`这是一个简单的使用场景
            1. 需要给 Screen 或者 Layout 设置一个 skipLoading={platformEnv.isNativeIOS} 以确保 iOS controller.headerSearch 动画正常

            2. useEffect(() => {
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
          title: '弹出 Modal',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                // @ts-expect-error
                navigation.pushModal(EDemoRootRoutes.Modal, {
                  screen: ERootModalRoutes.DemoLockedModal,
                });
              }}
            >
              弹出 Modal
            </Button>
          ),
        },
        {
          title: '下一个例子',
          element: (
            <Button
              variant="primary"
              onPress={() => {
                navigation.push(EDemoHomeTabRoutes.DemoRootHomeOptions);
              }}
            >
              跳转自定义 headerRight Demo
            </Button>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootHomeSearch" />
              <NavigationFocusTools componentName="DemoRootHomeSearch" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHomeSearch;
