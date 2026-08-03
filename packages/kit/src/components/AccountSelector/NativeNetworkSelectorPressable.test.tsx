import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';
import { Pressable, View } from 'react-native';

import {
  NativeNetworkSelectorPressable,
  resolveNativeNetworkSelectorPressableTestIDs,
} from './NativeNetworkSelectorPressable';

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const MockPressable = ({
    children,
    ...props
  }: {
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
    [key: string]: unknown;
  }) =>
    ReactModule.createElement(
      'Pressable',
      props,
      typeof children === 'function' ? children({ pressed: false }) : children,
    );
  return {
    Pressable: MockPressable,
    StyleSheet: { flatten: (style: unknown) => style ?? {} },
    View: 'View',
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: true,
  },
}));

describe('iOS native network selector pressable leaves', () => {
  it('keeps legacy product IDs while exposing one explicit clickable leaf ID', () => {
    expect(
      resolveNativeNetworkSelectorPressableTestIDs({
        isNativeIOS: true,
        legacyTestID: 'all-networks-manager-item-btc--0',
        nativePressableTestID: 'select-item-btc--0',
        useNativePressable: true,
      }),
    ).toEqual({
      clickableLeafTestID: 'select-item-btc--0',
      contentTestID: 'all-networks-manager-item-btc--0',
    });
    expect(
      resolveNativeNetworkSelectorPressableTestIDs({
        isNativeIOS: true,
        legacyTestID: 'select-item-btc--0',
        useNativePressable: true,
      }),
    ).toEqual({
      clickableLeafTestID: 'select-item-btc--0',
      contentTestID: undefined,
    });
  });

  it('exposes the All Networks trigger identifier on the only clickable leaf', () => {
    const onPress = jest.fn();
    const view = render(
      <NativeNetworkSelectorPressable
        accessibilityLabel="All Networks"
        accessibilityRole="button"
        onPress={onPress}
        testID="account-network-trigger-button"
      >
        <View testID="all-networks-trigger-content" />
      </NativeNetworkSelectorPressable>,
    );

    const trigger = view.getByTestId('account-network-trigger-button');
    expect(view.UNSAFE_getByType(Pressable).props.testID).toBe(
      'account-network-trigger-button',
    );
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(view.getAllByTestId('account-network-trigger-button')).toHaveLength(
      1,
    );
    const triggerOnPress = trigger.props.onPress as () => void;
    triggerOnPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('moves a select-item identifier to the native Pressable without a duplicate onPress', () => {
    const onPress = jest.fn();
    const view = render(
      <NativeNetworkSelectorPressable
        accessibilityLabel="Bitcoin"
        accessibilityRole="button"
        cancelable
        onPress={onPress}
        testID="select-item-btc--0"
        unstable_pressDelay={50}
      >
        <View testID="select-item-content" />
      </NativeNetworkSelectorPressable>,
    );

    const item = view.getByTestId('select-item-btc--0');
    expect(view.UNSAFE_getByType(Pressable).props.testID).toBe(
      'select-item-btc--0',
    );
    expect(item.props.accessibilityRole).toBe('button');
    expect(item.props.cancelable).toBe(true);
    expect(item.props.unstable_pressDelay).toBe(50);
    expect(view.getAllByTestId('select-item-btc--0')).toHaveLength(1);
    const itemOnPress = item.props.onPress as () => void;
    itemOnPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
