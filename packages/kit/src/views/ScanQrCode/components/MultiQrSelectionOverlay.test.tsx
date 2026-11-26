/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { createElement } from 'react';

import { UR, UREncoder } from '@ngraveio/bc-ur';
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
  Platform: {
    select: ({
      native,
      default: fallback,
    }: {
      native: boolean;
      default: boolean;
    }) => (platformEnv.isNative ? native : fallback),
  },
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

function fountainParts(value: number) {
  const encoder = new UREncoder(UR.fromBuffer(Buffer.alloc(200, value)), 40);
  return Array.from({ length: 4 }, () => encoder.nextPart());
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

  it('requests refocus at the tapped normalized point and keeps explicit cancel separate', () => {
    (platformEnv as { isNative?: boolean }).isNative = true;
    const onRefocus = jest.fn();
    const onCancel = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MultiQrSelectionOverlay
          symbols={symbols}
          onSelect={jest.fn()}
          onCancel={onCancel}
          onRefocus={onRefocus}
        />,
      );
    });
    const overlay = renderer!.root.findByProps({
      testID: 'multi-qr-selection-overlay',
    });
    act(() => {
      (overlay.props.onLayout as (event: LayoutChangeEvent) => void)({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
      } as LayoutChangeEvent);
    });
    const backdrop = renderer!.root.findByProps({
      testID: 'multi-qr-selection-backdrop',
    });
    act(() => {
      (backdrop.props.onPress as (event: object) => void)({
        nativeEvent: { locationX: 100, locationY: 600 },
      });
    });
    expect(onRefocus).toHaveBeenCalledWith({ x: 0.25, y: 0.75 });
    expect(onCancel).not.toHaveBeenCalled();
    const cancel = renderer!.root.findByProps({
      testID: 'multi-qr-selection-cancel',
    });
    act(() => (cancel.props.onPress as () => void)());
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });

  it('uses browser pointer coordinates and resumes without focusing on keyboard activation', () => {
    (platformEnv as { isNative?: boolean }).isNative = false;
    const onRefocus = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <MultiQrSelectionOverlay
          symbols={symbols}
          onSelect={jest.fn()}
          onCancel={jest.fn()}
          onRefocus={onRefocus}
        />,
      );
    });
    const backdrop = renderer!.root.findByProps({
      testID: 'multi-qr-selection-backdrop',
    });
    const currentTarget = document.createElement('button');
    jest.spyOn(currentTarget, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 100,
      width: 400,
      height: 800,
    } as DOMRect);
    const press = backdrop.props.onPress as (event: object) => void;
    act(() => {
      press({
        currentTarget,
        nativeEvent: new MouseEvent('click', {
          detail: 1,
          clientX: 150,
          clientY: 700,
        }),
      });
      press({
        currentTarget,
        nativeEvent: new MouseEvent('click', { detail: 0 }),
      });
    });
    expect(onRefocus.mock.calls).toEqual([[{ x: 0.25, y: 0.75 }], []]);
    act(() => renderer!.unmount());
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
  const [firstPart, nextPart] = fountainParts(1);
  const [foreignPart] = fountainParts(2);
  const ur = { text: firstPart, centerX: 0.8, centerY: 0.5 };
  expect(coordinator.receiveFrame([address, ur])).toBe(true);
  coordinator.cancelSelection();
  expect(onFrozenChange).toHaveBeenLastCalledWith(false);
  expect(
    coordinator.receiveFrame([address, { ...ur, text: nextPart }]),
  ).toBeUndefined();
  expect(onFrozenChange).toHaveBeenLastCalledWith(false);
  expect(
    coordinator.receiveFrame([address, { ...ur, text: foreignPart }]),
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
  const [firstPart, nextPart] = fountainParts(3);
  const goodUr = { text: firstPart, centerX: 0.8, centerY: 0.5 };
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
    coordinator.receiveFrame([{ ...goodUr, text: nextPart }, address]);
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

test('foreign, ignored and duplicated UR parts do not starve the advancing part', async () => {
  const address = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
  const [firstPart, ignoredPart, duplicatePart, nextPart] = fountainParts(4);
  const [foreignPart] = fountainParts(5);
  const first = { text: firstPart, centerX: 0.8, centerY: 0.5 };
  const foreign = { ...first, text: foreignPart };
  const ignored = { ...first, text: ignoredPart };
  const duplicate = { ...first, text: duplicatePart };
  const next = { ...first, text: nextPart };
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
    coordinator.receiveFrame([foreign, ignored, duplicate, next]);
  });
  expect(onCommitText.mock.calls.map(([text]) => text)).toEqual([
    first.text,
    ignored.text,
    duplicate.text,
    next.text,
  ]);
  expect(coordinator.phase).toBe('normal');
});

test('two refocus cycles reacquire old codes without submitting an old singleton', async () => {
  jest.useFakeTimers();
  try {
    const onSelectingChange = jest.fn();
    const onCommitText = jest.fn(async () => 'complete' as const);
    const coordinator = createMultiSymbolCoordinator({
      onFrozenChange: jest.fn(),
      onMultiSymbolChange: jest.fn(),
      onSelectingChange,
      onCommitText,
    });
    const a = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
    const b = { text: 'ethereum:0x222', centerX: 0.8, centerY: 0.5 };
    expect(coordinator.receiveFrame([a, b])).toBe(true);
    coordinator.refocus();
    for (let index = 0; index < 6; index += 1) {
      jest.advanceTimersByTime(50);
      expect(coordinator.receiveFrame([a])).toBeUndefined();
      coordinator.refocus();
    }
    jest.advanceTimersByTime(50);
    expect(coordinator.receiveFrame([a, b])).toBe(true);

    coordinator.refocus();
    jest.advanceTimersByTime(350);
    expect(coordinator.receiveFrame([a])).toBe(true);
    expect(onSelectingChange).toHaveBeenLastCalledWith([a]);
    coordinator.refocus();
    jest.advanceTimersByTime(350);
    expect(coordinator.receiveFrame([b])).toBe(true);
    expect(onSelectingChange).toHaveBeenLastCalledWith([b]);
    jest.advanceTimersByTime(1000);
    expect(onCommitText).not.toHaveBeenCalled();
    await act(async () => coordinator.selectSymbol(b));
    expect(onCommitText).toHaveBeenCalledWith(b.text, 'static');
    coordinator.dispose();
  } finally {
    jest.useRealTimers();
  }
});

test('refocusing a different picker still requires confirmation of an earlier candidate', async () => {
  jest.useFakeTimers();
  try {
    const onSelectingChange = jest.fn();
    const onCommitText = jest.fn(async () => 'complete' as const);
    const coordinator = createMultiSymbolCoordinator({
      aggregationWindowMs: 140,
      onFrozenChange: jest.fn(),
      onMultiSymbolChange: jest.fn(),
      onSelectingChange,
      onCommitText,
    });
    const a = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
    const b = { text: 'ethereum:0x222', centerX: 0.8, centerY: 0.5 };
    const c = { ...a, text: 'ethereum:0x333' };
    const d = { ...b, text: 'ethereum:0x444' };

    expect(coordinator.receiveFrame([a, b])).toBe(true);
    coordinator.refocus();
    jest.advanceTimersByTime(350);
    coordinator.receiveFrame([c]);
    expect(coordinator.receiveFrame([c, d])).toBe(true);
    coordinator.refocus();
    jest.advanceTimersByTime(350);
    coordinator.receiveFrame([b]);
    jest.advanceTimersByTime(140);

    expect(onCommitText).not.toHaveBeenCalled();
    expect(onSelectingChange).toHaveBeenLastCalledWith([b]);
    await act(async () => coordinator.selectSymbol(b));
    expect(onCommitText).toHaveBeenCalledWith(b.text, 'static');
  } finally {
    jest.useRealTimers();
  }
});

test('explicit cancel suppresses only the candidates on the current picker', () => {
  jest.useFakeTimers();
  try {
    const coordinator = createMultiSymbolCoordinator({
      onFrozenChange: jest.fn(),
      onMultiSymbolChange: jest.fn(),
      onSelectingChange: jest.fn(),
      onCommitText: jest.fn(async () => 'complete' as const),
    });
    const a = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
    const b = { text: 'ethereum:0x222', centerX: 0.5, centerY: 0.5 };
    const c = { text: 'ethereum:0x333', centerX: 0.8, centerY: 0.5 };
    expect(coordinator.receiveFrame([a, b])).toBe(true);
    coordinator.refocus();
    jest.advanceTimersByTime(350);
    expect(coordinator.receiveFrame([a, c])).toBe(true);
    coordinator.cancelSelection();
    expect(coordinator.receiveFrame([a, c])).toBeUndefined();
    expect(coordinator.receiveFrame([b, c])).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('cancel skips the old scene until a live tap, and retired preview verification cannot select', () => {
  jest.useFakeTimers();
  try {
    const onSelectingChange = jest.fn();
    const coordinator = createMultiSymbolCoordinator({
      onFrozenChange: jest.fn(),
      onMultiSymbolChange: jest.fn(),
      onSelectingChange,
      onCommitText: jest.fn(async () => 'complete' as const),
    });
    const a = { text: 'ethereum:0x111', centerX: 0.2, centerY: 0.5 };
    const b = { text: 'ethereum:0x222', centerX: 0.8, centerY: 0.5 };
    coordinator.receiveFrame([a, b]);
    coordinator.cancelSelection();
    jest.advanceTimersByTime(1500);
    expect(coordinator.needsSelection([a, b])).toBe(false);
    expect(coordinator.receiveFrame([a])).toBeUndefined();
    coordinator.refocus();
    jest.advanceTimersByTime(350);
    expect(coordinator.needsSelection([a])).toBe(true);
    const stale = coordinator.beginPreviewVerification();
    coordinator.refocus();
    expect(stale([a])).toBeUndefined();
    expect(onSelectingChange).toHaveBeenLastCalledWith([]);
    const fresh = coordinator.beginPreviewVerification();
    expect(fresh([a])).toBe(true);
    expect(onSelectingChange).toHaveBeenLastCalledWith([a]);
    coordinator.dispose();
  } finally {
    jest.useRealTimers();
  }
});
