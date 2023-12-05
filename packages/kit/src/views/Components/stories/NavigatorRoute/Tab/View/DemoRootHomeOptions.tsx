/* eslint-disable react/no-unstable-nested-components */
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Stack, YStack } from '@onekeyhq/components';
import HeaderButtonGroup from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderButtonGroup';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from '../../../utils/Layout';
import { NavigationFocusTools } from '../../../utils/NavigationTools';
import { FreezeProbe } from '../../../utils/RenderTools';
import useDemoAppNavigation from '../../useDemoAppNavigation';

import type {
  NativeSyntheticEvent,
  TextInputChangeEventData,
} from 'react-native';

const DemoRootHomeOptions = () => {
  const intl = useIntl();
  const navigation = useDemoAppNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButtonGroup>
          <HeaderIconButton icon="StarOutline" />
          <HeaderIconButton icon="ScanOutline" />
        </HeaderButtonGroup>
      ),
      headerSearchBarOptions: {
        hideNavigationBar: true,
        hideWhenScrolling: true,
        placeholder: intl.formatMessage({
          id: 'content__search_dapps_or_type_url',
        }),
        inputType: 'text',
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          console.log('onChangeText', event.nativeEvent.text),
      },
    });
  }, [navigation, intl]);

  return (
    <Layout
      skipLoading={platformEnv.isNativeIOS}
      contentInsetAdjustmentBehavior="automatic"
      description="这是一个路由 Header 演示自定义 headerRight 的用法"
      suggestions={[
        '使用方式与 @react-navigation/native-stack 相同',
        '同时可以正常使用 headerSearchBarOptions',
      ]}
      boundaryConditions={[
        '为了不破坏 Navigation 默认行为，只有一个 headerRight 图标可以根据官方 API 写，推荐使用 <HeaderIconButton> 组件，与 Icon 组件用法相同',
        '为了不破坏 Navigation 默认行为，如果是一个 headerRight 图标组需要使用 <HeaderButtonGroup> 组件，里面处理好了各种边距问题',
      ]}
      elements={[
        {
          title: 'HeaderIconButton 演示',
          element: (
            <YStack>
              <HeaderIconButton
                icon="CrossedLargeOutline"
                color="$borderColorHover"
                onPress={() => {
                  alert('clicked');
                }}
              />
              <HeaderIconButton
                icon="ChevronLeftOutline"
                onPress={() => {
                  alert('clicked');
                }}
              />
            </YStack>
          ),
        },
        {
          title: '渲染测试',
          element: (
            <Stack>
              <FreezeProbe componentName="DemoRootHomeOptions" />
              <NavigationFocusTools componentName="DemoRootHomeOptions" />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default DemoRootHomeOptions;
