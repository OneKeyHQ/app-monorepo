/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { createElement } from 'react';

import { act, create } from 'react-test-renderer';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  createMultiSymbolCoordinator,
  resolveRepelledAnchorPositions,
} from '../utils/multiQrSymbols';

import { MultiQrSelectionOverlay } from './MultiQrSelectionOverlay';

import type { IMultiSymbolCoordinatorOptions } from '../utils/multiQrSymbols';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({
  Image: 'img',
  Pressable: 'button',
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
      'button',
      { onPress, testID },
      createElement('span', null, children),
    ),
  Haptics: { impact: jest.fn() },
  Icon: ({ name }: { name: string }) => createElement('span', null, name),
  ImpactFeedbackStyle: { Light: 'light' },
  SizableText: ({ children }: { children?: ReactNode }) =>
    createElement('span', null, children),
  Stack: ({ children, ...props }: ViewProps & { children?: ReactNode }) =>
    createElement('div', props, children),
  YStack: ({ children, ...props }: ViewProps & { children?: ReactNode }) =>
    createElement('div', props, children),
}));

// Jest maps the components package and its subpaths to the UI mock.
const { useBackHandler } = jest.requireActual<
  Pick<typeof import('@onekeyhq/components'), 'useBackHandler'>
>('../../../../../components/src/hooks/useBackHandler');

function TestScannerModal({
  children,
  onBack,
}: {
  children?: ReactNode;
  onBack: () => boolean;
}) {
  useBackHandler(onBack, true, false);
  return children;
}

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
    expect(dot1.props.hitSlop).toBeGreaterThanOrEqual(4);
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

  it('gives Escape to the photo picker above the live picker', () => {
    (platformEnv as { isNative?: boolean }).isNative = false;
    const dismissLive = jest.fn();
    const dismissPhoto = jest.fn();
    const live = (
      <MultiQrSelectionOverlay
        symbols={symbols}
        onSelect={jest.fn()}
        onCancel={dismissLive}
      />
    );
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <>
          {live}
          <MultiQrSelectionOverlay
            symbols={symbols}
            imageUri="file:///picked.png"
            onSelect={jest.fn()}
            onCancel={dismissPhoto}
          />
        </>,
      );
    });
    const escape = () => {
      for (const type of ['keydown', 'keyup']) {
        document.body.dispatchEvent(
          new KeyboardEvent(type, { key: 'Escape', bubbles: true }),
        );
      }
    };
    act(escape);
    expect(dismissPhoto).toHaveBeenCalledTimes(1);
    expect(dismissLive).not.toHaveBeenCalled();
    act(() => renderer!.update(<>{live}</>));
    act(escape);
    expect(dismissLive).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });

  it('dismisses the album picker on the first Escape and the scanner on the next', () => {
    (platformEnv as { isNative?: boolean }).isNative = false;
    const modalBack = jest.fn(() => true);
    const originalAddEventListener = globalThis.addEventListener;
    // Restore the window listener that the shared Jest setup stubs out.
    globalThis.addEventListener =
      EventTarget.prototype.addEventListener.bind(globalThis);

    const onCancel = jest.fn();
    let renderer: ReactTestRenderer;
    try {
      act(() => {
        renderer = create(
          <TestScannerModal onBack={modalBack}>
            <MultiQrSelectionOverlay
              symbols={symbols}
              imageUri="file:///picked.png"
              imageSize={{ width: 800, height: 400 }}
              onSelect={jest.fn()}
              onCancel={onCancel}
            />
          </TestScannerModal>,
        );
      });

      expect(
        renderer!.root.findByProps({ testID: 'multi-qr-selection-image' }),
      ).toBeTruthy();
      expect(Haptics.impact).not.toHaveBeenCalled();

      const keyDown = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      const keyUp = new KeyboardEvent('keyup', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        document.body.dispatchEvent(keyDown);
      });
      expect(onCancel).not.toHaveBeenCalled();
      act(() => {
        document.body.dispatchEvent(keyUp);
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(keyDown.defaultPrevented).toBe(true);
      expect(keyUp.defaultPrevented).toBe(true);
      expect(modalBack).not.toHaveBeenCalled();

      act(() => {
        renderer!.update(<TestScannerModal onBack={modalBack} />);
      });
      act(() => {
        for (const type of ['keydown', 'keyup']) {
          document.body.dispatchEvent(
            new KeyboardEvent(type, { key: 'Escape', bubbles: true }),
          );
        }
      });
      expect(modalBack).toHaveBeenCalledTimes(1);
    } finally {
      act(() => renderer?.unmount());
      globalThis.addEventListener = originalAddEventListener;
    }
  });
});

test('a dismissed mixed scene stays live across advancing UR parts and can show a changed set', () => {
  const onFrozenChange = jest.fn();
  const coordinator = createMultiSymbolCoordinator({
    onFrozenChange,
    onMultiSymbolChange: jest.fn(),
    onSelectingChange: jest.fn(),
    onCommitText: jest.fn(async () => 'progress' as const),
  });
  const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
  const ur = { text: 'ur:bytes/1-2/abcd', centerX: 0.8, centerY: 0.5 };
  expect(coordinator.receiveFrame([address, ur])).toBe(true);
  coordinator.cancelSelection();
  expect(onFrozenChange).toHaveBeenLastCalledWith(false);
  expect(
    coordinator.receiveFrame([address, { ...ur, text: 'ur:bytes/2-2/efgh' }]),
  ).toBeUndefined();
  expect(onFrozenChange).toHaveBeenLastCalledWith(false);
  expect(
    coordinator.receiveFrame([{ ...address, text: 'ethereum:0x222' }, ur]),
  ).toBe(true);
});

test('a selected UR binds only after its first part is accepted, then resumes after completion', async () => {
  const onFrozenChange = jest.fn();
  const rejected = Promise.withResolvers<'ignored'>();
  const onCommitText = jest
    .fn<
      Promise<'ignored' | 'progress' | 'complete'>,
      [string, 'static' | 'ur']
    >()
    .mockReturnValueOnce(rejected.promise)
    .mockResolvedValueOnce('progress')
    .mockResolvedValueOnce('complete');
  const coordinator = createMultiSymbolCoordinator({
    onFrozenChange,
    onMultiSymbolChange: jest.fn(),
    onSelectingChange: jest.fn(),
    onCommitText,
  });
  const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
  const badUr = { text: 'ur:bytes/1-3/bad', centerX: 0.7, centerY: 0.5 };
  const goodUr = { text: 'ur:bytes/1-2/good', centerX: 0.8, centerY: 0.5 };
  coordinator.receiveFrame([address, badUr, goodUr]);
  await act(async () => {
    coordinator.selectSymbol(badUr);
    rejected.resolve('ignored');
  });
  expect(coordinator.phase).toBe('selecting');
  expect(onFrozenChange).toHaveBeenLastCalledWith(true);
  await act(async () => coordinator.selectSymbol(goodUr));
  expect(coordinator.phase).toBe('ur-streaming');
  expect(onFrozenChange).toHaveBeenLastCalledWith(false);
  await act(async () => {
    coordinator.receiveFrame([
      { ...goodUr, text: 'ur:bytes/2-2/next' },
      address,
    ]);
  });
  expect(coordinator.phase).toBe('normal');
});

test('markers with coincident clamped coordinates keep separate hit targets', () => {
  const [left, right] = resolveRepelledAnchorPositions(
    [
      { text: 'first', centerX: 0.04, centerY: 0.3 },
      { text: 'second', centerX: 0.07, centerY: 0.3 },
    ],
    320,
    320,
  );
  expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeGreaterThanOrEqual(
    44,
  );
});

test('retrying a blocked camera submission reopens static scanning', async () => {
  const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
  const onCommitText = jest
    .fn<
      ReturnType<IMultiSymbolCoordinatorOptions['onCommitText']>,
      Parameters<IMultiSymbolCoordinatorOptions['onCommitText']>
    >()
    .mockResolvedValueOnce('retry')
    .mockResolvedValueOnce('ignored');
  const coordinator = createMultiSymbolCoordinator({
    aggregationWindowMs: 0,
    onFrozenChange: jest.fn(),
    onMultiSymbolChange: jest.fn(),
    onSelectingChange: jest.fn(),
    onCommitText,
  });
  await act(async () => {
    coordinator.receiveFrame([address]);
  });
  expect(coordinator.phase).toBe('normal');
  await act(async () => {
    coordinator.receiveFrame([address]);
  });
  expect(onCommitText).toHaveBeenCalledTimes(2);
});

test('retrying a selected static code can reopen the same multi-QR scene', async () => {
  const codes = [
    { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 },
    { text: 'ethereum:0x222', centerX: 0.8, centerY: 0.5 },
  ];
  const onCommitText = jest
    .fn<
      ReturnType<IMultiSymbolCoordinatorOptions['onCommitText']>,
      Parameters<IMultiSymbolCoordinatorOptions['onCommitText']>
    >()
    .mockResolvedValueOnce('retry')
    .mockResolvedValueOnce('ignored');
  const coordinator = createMultiSymbolCoordinator({
    onFrozenChange: jest.fn(),
    onMultiSymbolChange: jest.fn(),
    onSelectingChange: jest.fn(),
    onCommitText,
  });
  expect(coordinator.receiveFrame(codes)).toBe(true);
  await act(async () => coordinator.selectSymbol(codes[0]));

  expect(coordinator.receiveFrame(codes)).toBe(true);
  await act(async () => coordinator.selectSymbol(codes[0]));
  expect(onCommitText.mock.calls).toEqual([
    [codes[0].text, 'static'],
    [codes[0].text, 'static'],
  ]);
});

test('preview verification cancels a pending static result and ignores fresh frames until it settles', () => {
  jest.useFakeTimers();
  try {
    const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
    const ur = { text: 'ur:bytes/1-2/first', centerX: 0.8, centerY: 0.5 };
    const onCommitText = jest
      .fn<Promise<'ignored'>, [string, 'static' | 'ur']>()
      .mockResolvedValue('ignored');
    const coordinator = createMultiSymbolCoordinator({
      onFrozenChange: jest.fn(),
      onMultiSymbolChange: jest.fn(),
      onSelectingChange: jest.fn(),
      onCommitText,
    });
    coordinator.receiveFrame([address]);
    expect(coordinator.needsSelection([address, ur])).toBe(true);
    const finish = coordinator.beginPreviewVerification();
    coordinator.receiveFrame([ur]);
    jest.advanceTimersByTime(200);
    expect(onCommitText).not.toHaveBeenCalled();
    expect(finish([address, ur])).toBe(true);
    expect(coordinator.phase).toBe('selecting');
    coordinator.reset();
    coordinator.receiveFrame([address]);
    const fail = coordinator.beginPreviewVerification();
    fail();
    jest.advanceTimersByTime(200);
    expect(onCommitText).not.toHaveBeenCalled();
    expect(coordinator.phase).toBe('normal');
  } finally {
    jest.useRealTimers();
  }
});

test('a rejected or duplicated UR does not starve the advancing part in the same frame', async () => {
  const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
  const first = { text: 'ur:bytes/1-2/first', centerX: 0.8, centerY: 0.5 };
  const foreign = { ...first, text: 'ur:bytes/2-2/foreign' };
  const duplicate = { ...first, text: 'ur:bytes/1-2/dup' };
  const next = { ...first, text: 'ur:bytes/2-2/next' };
  const onCommitText = jest
    .fn<
      ReturnType<IMultiSymbolCoordinatorOptions['onCommitText']>,
      Parameters<IMultiSymbolCoordinatorOptions['onCommitText']>
    >()
    .mockResolvedValueOnce('progress')
    .mockResolvedValueOnce('ignored')
    .mockResolvedValueOnce('duplicate')
    .mockResolvedValueOnce('complete');
  const coordinator = createMultiSymbolCoordinator({
    onFrozenChange: jest.fn(),
    onMultiSymbolChange: jest.fn(),
    onSelectingChange: jest.fn(),
    onCommitText,
  });
  coordinator.receiveFrame([address, first]);
  await act(async () => {
    coordinator.selectSymbol(first);
  });
  await act(async () => {
    coordinator.receiveFrame([foreign, duplicate, next]);
  });
  expect(onCommitText.mock.calls.map(([text]) => text)).toEqual([
    first.text,
    foreign.text,
    duplicate.text,
    next.text,
  ]);
  expect(coordinator.phase).toBe('normal');
});
