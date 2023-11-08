import { useCallback, useContext } from 'react';

import { NavigationHelpersContext } from '@react-navigation/core';
import { HeaderBackContext, getHeaderTitle } from '@react-navigation/elements';

import DelayedFreeze from '../../DelayedFreeze';
import useBackHandler from '../../Provider/hooks/useBackHandler';
import { Stack, ZStack } from '../../Stack';
import { HeaderView } from '../Header';

import CenteredModal from './CenteredModal';
import ModalBackdrop from './ModalBackdrop';

import type {
  ModalDescriptorMap,
  IModalNavigationConfig,
  IModalNavigationHelpers,
} from './types';
import type {
  ParamListBase,
  StackNavigationState,
} from '@react-navigation/native';

type IProps = IModalNavigationConfig & {
  state: StackNavigationState<ParamListBase>;
  navigation: IModalNavigationHelpers;
  descriptors: ModalDescriptorMap;
};

export default function ModalStackView({
  state,
  navigation,
  descriptors,
}: IProps) {
  const parentHeaderBack = useContext(HeaderBackContext);
  // const currentRoute = state.routes[state.index];
  // const descriptor = descriptors[currentRoute.key];
  // const { disableClose }: { disableClose?: boolean } = descriptor.options;

  const goBackCall = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBackPress = useCallback(() => {
    const currentRoute = state.routes[state.index];
    const descriptor = descriptors[currentRoute.key];
    const { disableClose }: { disableClose?: boolean } = descriptor.options;

    if (disableClose) {
      return true;
    }
    if (navigation.isFocused()) goBackCall();
    return true;
  }, [state.routes, state.index, descriptors, navigation, goBackCall]);

  useBackHandler(handleBackPress);

  return (
    <NavigationHelpersContext.Provider value={navigation}>
      <ZStack style={{ flex: 1 }}>
        {/* Background Layer, Android blinks so you need a placeholder background */}
        <ModalBackdrop />

        {/* Modal Layer */}
        {state.routes.map((route, index) => {
          const focused = index === state.index;

          const descriptor = descriptors[route.key];
          const previousRoute = index > 0 ? state.routes[index - 1] : null;
          const previousKey = previousRoute?.key;
          const previousDescriptor = previousKey
            ? descriptors[previousKey]
            : undefined;

          const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            animationType = 'none',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            freezeOnBlur = true,
            ...options
          }: {
            animationType?: 'none' | 'fade' | 'slide';
            freezeOnBlur?: boolean;
            disableClose?: boolean;
          } = descriptor.options;

          const disableClose = options.disableClose ?? false;

          const headerBack = previousDescriptor
            ? {
                title: getHeaderTitle(
                  previousDescriptor.options,
                  previousDescriptor.route.name,
                ),
              }
            : parentHeaderBack;

          return (
            <DelayedFreeze key={route.key} freeze={freezeOnBlur && !focused}>
              <CenteredModal
                key={route.key}
                visible={focused}
                disableClose={disableClose}
                onClose={goBackCall}
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
                <Stack flex={1} width="100%" testID="APP-Modal-Screen-Content">
                  {descriptor.render()}
                </Stack>
              </CenteredModal>
            </DelayedFreeze>
          );
        })}
      </ZStack>
    </NavigationHelpersContext.Provider>
  );
}
