/** @jest-environment jsdom */
import type { ComponentProps } from 'react';

import { render } from '@testing-library/react';

import { NativeBottomTabView } from './NativeBottomTabView';

type IBottomTabsProps = {
  onTabDoublePress: (index: number, didScrollToTop?: boolean) => void;
};

let latestBottomTabsProps: IBottomTabsProps | undefined;

jest.mock('@onekeyfe/react-native-bottom-tabs', () => ({
  __esModule: true,
  default: (props: IBottomTabsProps) => {
    latestBottomTabsProps = props;
    return null;
  },
}));
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CommonActions: {
      navigate: (route: unknown) => ({ type: 'NAVIGATE', payload: route }),
    },
    StackActions: { popToTop: () => ({ type: 'POP_TO_TOP' }) },
    NavigationMetaContext: React.createContext<object | undefined>(undefined),
  };
});
jest.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: () => null,
}));
jest.mock('../../../primitives', () => ({
  Spinner: () => null,
  Stack: () => null,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));

type IViewProps = ComponentProps<typeof NativeBottomTabView>;

const emptyDescriptors = {} as IViewProps['descriptors'];

function createNavigation() {
  return { emit: jest.fn(), dispatch: jest.fn() };
}

function createState(stackIndex: number) {
  return {
    key: 'tab-state',
    index: 0,
    routeNames: ['Discovery'],
    routes: [
      {
        key: 'Discovery-key',
        name: 'Discovery',
        state: {
          key: 'discovery-stack',
          index: stackIndex,
          routes: [],
        },
      },
    ],
    preloadedRouteKeys: [],
  } as unknown as IViewProps['state'];
}

function renderTabView(stackIndex: number) {
  const navigation = createNavigation();
  const state = createState(stackIndex);
  const tabNavigation = navigation as unknown as IViewProps['navigation'];
  render(
    <NativeBottomTabView
      state={state}
      navigation={tabNavigation}
      descriptors={emptyDescriptors}
    />,
  );
  expect(latestBottomTabsProps).toBeDefined();
  const { onTabDoublePress } = latestBottomTabsProps as IBottomTabsProps;
  return { navigation, onTabDoublePress };
}

describe('NativeBottomTabView double press', () => {
  beforeEach(() => {
    latestBottomTabsProps = undefined;
  });

  it('pops the inner stack to its root when the page is already at the top', () => {
    const { navigation, onTabDoublePress } = renderTabView(2);

    onTabDoublePress(0, false);

    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'tabDoublePress',
      target: 'Discovery-key',
    });
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith({
      type: 'POP_TO_TOP',
      target: 'discovery-stack',
    });
  });

  it('stays on the inner page when native scrolled it to the top', () => {
    const { navigation, onTabDoublePress } = renderTabView(2);

    onTabDoublePress(0, true);

    expect(navigation.emit).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('does not pop when native reports no scroll state', () => {
    const { navigation, onTabDoublePress } = renderTabView(2);

    onTabDoublePress(0, undefined);

    expect(navigation.emit).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('does not pop when the stack is already at its root', () => {
    const { navigation, onTabDoublePress } = renderTabView(0);

    onTabDoublePress(0, false);

    expect(navigation.dispatch).not.toHaveBeenCalled();
  });
});
