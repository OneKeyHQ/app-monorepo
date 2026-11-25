/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { createElement } from 'react';

import { Pressable, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MultiQrSelectionOverlay } from './MultiQrSelectionOverlay';

import type { LayoutChangeEvent, ViewProps } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    createElement(
      Pressable,
      { onPress, testID },
      createElement(Text, null, children),
    ),
  Haptics: { impact: jest.fn() },
  Icon: ({ name }: { name: string }) => createElement(Text, null, name),
  ImpactFeedbackStyle: { Light: 'light' },
  SizableText: ({ children }: { children?: ReactNode }) =>
    createElement(Text, null, children),
  Stack: ({ children, ...props }: ViewProps & { children?: ReactNode }) =>
    createElement(View, props, children),
  YStack: ({ children, ...props }: ViewProps & { children?: ReactNode }) =>
    createElement(View, props, children),
}));

describe('MultiQrSelectionOverlay', () => {
  const symbols = [
    { text: 'ethereum:0x111', centerX: 0.25, centerY: 0.3 },
    { text: 'wc:222', centerX: 0.75, centerY: 0.7 },
  ];

  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (platformEnv as { isNative?: boolean }).isNative = originalIsNative;
  });

  it('renders nothing when symbols is empty', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MultiQrSelectionOverlay
          symbols={[]}
          onSelect={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders green dot markers after layout, selects tapped symbol, and triggers native haptics', () => {
    (platformEnv as { isNative?: boolean }).isNative = true;
    const onSelect = jest.fn();
    const onCancel = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MultiQrSelectionOverlay
          symbols={symbols}
          onSelect={onSelect}
          onCancel={onCancel}
        />,
      );
    });
    expect(Haptics.impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);

    const root = renderer!.root.findByProps({
      testID: 'multi-qr-selection-overlay',
    });
    const onLayout = root.props.onLayout as (event: LayoutChangeEvent) => void;
    act(() => {
      onLayout({
        nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
      } as LayoutChangeEvent);
    });

    const dot1 = renderer!.root.findByProps({ testID: 'multi-qr-dot-1' });
    const onDotPress = dot1.props.onPress as () => void;
    act(() => {
      onDotPress();
    });
    expect(onSelect).toHaveBeenCalledWith(symbols[1]);

    const backdrop = renderer!.root.findByProps({
      testID: 'multi-qr-selection-backdrop',
    });
    const onBackdropPress = backdrop.props.onPress as () => void;
    act(() => {
      onBackdropPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders picked album image and handles Escape key on web/desktop', () => {
    (platformEnv as { isNative?: boolean }).isNative = false;
    const listeners: Record<string, EventListener> = {};
    const originalAdd = globalThis.addEventListener;
    const originalRemove = globalThis.removeEventListener;
    globalThis.addEventListener = ((
      event: string,
      fn: EventListenerOrEventListenerObject,
    ) => {
      if (typeof fn === 'function') listeners[event] = fn;
    }) as typeof globalThis.addEventListener;
    globalThis.removeEventListener =
      (() => {}) as typeof globalThis.removeEventListener;

    const onCancel = jest.fn();
    let renderer: ReactTestRenderer;
    try {
      act(() => {
        renderer = create(
          <MultiQrSelectionOverlay
            symbols={symbols}
            imageUri="file:///picked.png"
            imageSize={{ width: 800, height: 400 }}
            onSelect={jest.fn()}
            onCancel={onCancel}
          />,
        );
      });

      expect(
        renderer!.root.findByProps({ testID: 'multi-qr-selection-image' }),
      ).toBeTruthy();
      expect(Haptics.impact).not.toHaveBeenCalled();

      act(() => {
        listeners.keydown?.({
          key: 'Escape',
          preventDefault: jest.fn(),
        } as unknown as Event);
      });
      expect(onCancel).toHaveBeenCalledTimes(1);

      act(() => {
        renderer!.unmount();
      });
    } finally {
      globalThis.addEventListener = originalAdd;
      globalThis.removeEventListener = originalRemove;
    }
  });
});
