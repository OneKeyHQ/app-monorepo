import type { Component, ComponentType, ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { Modal, TouchableOpacity } from 'react-native';
import { Stack } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import { HeaderView } from '../Header';
import { createStackNavigator } from '../StackNavigator';

import { hasNativeModal } from './CommonConfig.ts';

import type { StackNavigationOptions } from '../StackNavigator';
import type { CommonNavigatorConfig } from './types';
import type { RouteConfigComponent } from '@react-navigation/core/lib/typescript/src/types';
import type { ParamListBase } from '@react-navigation/routers';

interface ModalFlowNavigatorConfig<P extends ParamListBase>
  extends CommonNavigatorConfig<P> {
  translationId: string;
  disableClose?: boolean;
}

interface ModalFlowNavigatorProps<P extends ParamListBase> {
  config: ModalFlowNavigatorConfig<P>[];
}

export function createModalFlowNavigatorConfig<P extends ParamListBase>(
  config: ModalFlowNavigatorConfig<P>[],
): ModalFlowNavigatorConfig<P>[] {
  return config;
}

function ModalShadowScreen({ children }: { children: ReactElement }) {
  if (platformEnv.isNativeAndroid) {
    return (
      <Modal
        transparent
        animationType="fade"
        visible
        // onRequestClose={() => navigation.goBack()}
      >
        <Stack
          flex={1}
          backgroundColor="$bgBackdrop"
          $md={{
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
          }}
          $gtMd={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {children}
        </Stack>
      </Modal>
    );
  }

  return (
    <Stack
      flex={1}
      backgroundColor="$bgBackdrop"
      justifyContent="center"
      alignItems="center"
      // onPress={currentNavigation?.goBack}
      pointerEvents="box-none"
    >
      {children}
    </Stack>
  );
}

function SimpleModal({
  children,
  options,
}: {
  children: ComponentType;
  options: StackNavigationOptions;
}) {
  const currentRoute = useRoute();
  const currentNavigation = useNavigation();
  return (
    <ModalShadowScreen>
      <Stack
        flexDirection="column"
        testID="APP-Modal-Screen"
        backgroundColor="$bg"
        $md={{
          width: '100%',
          height: '99%',
          borderTopStartRadius: '$2',
          borderTopEndRadius: '$2',
        }}
        $gtMd={{
          width: '$160',
          height: '$160',
          borderRadius: '$2',
        }}
      >
        <Stack width="100%">
          <HeaderView
            options={options}
            route={currentRoute}
            navigation={currentNavigation}
            isModelScreen
            isFlowModelScreen
          />
        </Stack>

        <Stack flex={1} width="100%">
          {children}
        </Stack>
      </Stack>
    </ModalShadowScreen>
  );
}

function withSimpleModal(
  Component: ComponentType,
  screenOptions: StackNavigationOptions,
) {
  return function (props: RouteConfigComponent['component']) {
    return (
      <SimpleModal options={screenOptions}>
        <Component {...props} />
      </SimpleModal>
    );
  };
}

export function ModalFlowNavigator<P extends ParamListBase>({
  config,
}: ModalFlowNavigatorProps<P>) {
  const ModalStack = createStackNavigator<P>();
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <ModalStack.Navigator
      screenOptions={(navInfo) => ({
        ...makeModalStackNavigatorOptions({ navInfo, isVerticalLayout }),
      })}
    >
      {config.map(
        ({ name, component, options, translationId, disableClose }) => {
          const customOptions = {
            ...options,
            gestureEnabled: disableClose,
            title: translationId,
          };

          const WrappedComponent = hasNativeModal
            ? component
            : withSimpleModal(component, customOptions);

          return (
            <ModalStack.Screen
              key={`Modal-Flow-${name as string}`}
              name={name}
              component={WrappedComponent}
              options={customOptions}
            />
          );
        },
      )}
    </ModalStack.Navigator>
  );
}
