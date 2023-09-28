import { useContext } from 'react';

import { NavigationHelpersContext } from '@react-navigation/core';
import { HeaderBackContext, getHeaderTitle } from '@react-navigation/elements';
import { View } from 'react-native';

import { Stack } from '../../Stack';
import { HeaderView } from '../Header';

import CenteredModal from './CenteredModal';

import type {
  ModalDescriptorMap,
  ModalNavigationConfig,
  ModalNavigationHelpers,
} from './types';
import type {
  ParamListBase,
  StackNavigationState,
} from '@react-navigation/native';

type Props = ModalNavigationConfig & {
  state: StackNavigationState<ParamListBase>;
  navigation: ModalNavigationHelpers;
  descriptors: ModalDescriptorMap;
};

export default function ModalStack({ state, navigation, descriptors }: Props) {
  const parentHeaderBack = useContext(HeaderBackContext);

  const currentRoute = state.routes[state.index];
  const previousRoute = state.index > 0 ? state.routes[state.index - 1] : null;
  const previousKey = previousRoute?.key;
  const previousDescriptor = previousKey ? descriptors[previousKey] : undefined;

  return (
    <NavigationHelpersContext.Provider value={navigation}>
      <View style={{ flex: 1 }}>
        {/* Background Layer */}
        <Stack flex={1} backgroundColor="$bgBackdrop" />
        <CenteredModal visible={state.routes.length > 0} animationType="none" />

        {/* Modal Layer */}
        {/* TODO: Do toggle animations can be used [previousRoute,currentRoute].filter */}
        {[currentRoute].filter(Boolean).map((route) => {
          const descriptor = descriptors[route.key];
          const focused = route.key === currentRoute.key;
          const { animationType = 'fade', ...options } = descriptor.options;

          const headerBack = previousDescriptor
            ? {
                title: getHeaderTitle(
                  previousDescriptor.options,
                  previousDescriptor.route.name,
                ),
              }
            : parentHeaderBack;

          return (
            <CenteredModal
              key={route.key}
              visible={focused}
              // @ts-expect-error
              animationType={animationType}
            >
              <HeaderView
                back={headerBack}
                options={options}
                route={route}
                // @ts-expect-error
                navigation={navigation}
                isModelScreen
                isFlowModelScreen
              />
              <Stack flex={1} width="100%">
                {descriptor.render()}
              </Stack>
            </CenteredModal>
          );
        })}
      </View>
    </NavigationHelpersContext.Provider>
  );
}
