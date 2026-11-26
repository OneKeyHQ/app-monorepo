/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
/* cspell:ignore שלום עולם */
import type { CSSProperties, ReactNode } from 'react';
import { isValidElement } from 'react';

import { DashText } from '.';

import { normalizeStyle } from '@tamagui/web';
import { act, render, screen } from '@testing-library/react';
import { I18nManager } from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText } from '../../primitives/SizeableText';
import { YStack } from '../../primitives/Stack';

import type { ISizableTextProps } from '../../primitives';
import type { LayoutChangeEvent, TextLayoutEvent } from 'react-native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-native', () => ({
  I18nManager: { isRTL: false },
  StyleSheet: { flatten: (style: unknown) => style },
  processColor: (color: string) =>
    color === 'transparent' ? 0 : 0xff_88_88_88,
}));
jest.mock('../../hooks/useStyle', () => ({ useMedia: () => ({ gtMd: true }) }));
jest.mock('../../shared/tamagui', () => ({
  useStyle: ({
    padding,
    paddingVertical,
    paddingBottom,
    p,
    py,
    pb,
  }: ISizableTextProps) =>
    normalizeStyle(
      {
        padding: padding ?? p,
        paddingVertical: paddingVertical ?? py,
        paddingBottom: paddingBottom ?? pb,
      },
      true,
    ),
  useTheme: () => ({ borderStrong: { val: '#888888' } }),
}));
jest.mock('../../primitives/Stack', () => {
  function Box({
    children,
    style,
    ...props
  }: {
    children?: ReactNode;
    style?: CSSProperties;
    [key: string]: unknown;
  }) {
    return (
      <div style={style} data-layout={JSON.stringify(props)}>
        {children}
      </div>
    );
  }
  return { XStack: Box, YStack: jest.fn(Box) };
});
jest.mock('../../primitives/SizeableText', () => ({
  SizableText: jest.fn(({ children }: ISizableTextProps) => (
    <span>{children}</span>
  )),
}));
jest.mock('../../actions/Tooltip', () => ({
  Tooltip: ({
    renderTrigger,
    renderContent,
  }: {
    renderTrigger: ReactNode;
    renderContent: ReactNode;
  }) => (
    <div data-testid="tooltip">
      {renderTrigger}
      <div>{renderContent}</div>
    </div>
  ),
}));
jest.mock('../../actions/Popover', () => ({
  Popover: ({
    renderTrigger,
    renderContent,
  }: {
    renderTrigger: ReactNode;
    renderContent: ReactNode;
  }) => (
    <div data-testid="popover">
      {renderTrigger}
      {renderContent}
    </div>
  ),
}));

function webFragmentStyle() {
  const calls = jest.mocked(SizableText).mock.calls;
  const child = calls[calls.length - 1][0].children;
  if (!isValidElement<{ style: CSSProperties }>(child)) {
    throw new OneKeyLocalError('Missing multiline fragment');
  }
  return child.props.style;
}

function layoutText(
  lines: { x: number; y: number; width: number; height: number }[],
) {
  const calls = jest.mocked(SizableText).mock.calls;
  const callback = calls[calls.length - 1][0].onTextLayout;
  if (typeof callback !== 'function') {
    throw new OneKeyLocalError('Missing native text layout handler');
  }
  void act(() => callback({ nativeEvent: { lines } } as TextLayoutEvent));
}

function underlines(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-layout]'),
  ).filter(
    (node) => JSON.parse(node.dataset.layout ?? '{}').position === 'absolute',
  );
}

beforeEach(() => {
  platformEnv.isNative = false;
  platformEnv.isNativeAndroid = false;
  I18nManager.isRTL = false;
  jest.clearAllMocks();
});

it('bounds each wrapped web fragment by the requested dash count and dimensions', () => {
  const view = render(
    <DashText multiline length={1} dashLength={4} dashGap={3} dashThickness={2}>
      Long label
    </DashText>,
  );
  const label = screen.getByText('Long label');
  expect(label.style.backgroundSize).toBe('4px 2px');
  expect(label.style.boxDecorationBreak).toBe('clone');
  expect(label.style.backgroundRepeat).toBe('no-repeat');
  // jsdom does not parse repeating gradients; inspect the emitted CSS value.
  expect(webFragmentStyle().backgroundImage).toBe(
    'repeating-linear-gradient(to right, #888888 0 4px, transparent 4px 7px)',
  );
  view.rerender(
    <DashText
      multiline
      length={3}
      dashLength={4}
      dashGap={3}
      dashColor="#123456"
    >
      Long label
    </DashText>,
  );
  expect(screen.getByText('Long label').style.backgroundSize).toBe(
    '18px 0.5px',
  );
  expect(webFragmentStyle().backgroundImage).toContain('#123456');
});

it('removes web multiline decoration when length is zero', () => {
  const view = render(
    <DashText multiline length={1}>
      Label
    </DashText>,
  );
  view.rerender(
    <DashText multiline length={0}>
      Label
    </DashText>,
  );
  expect(view.container.querySelector('[style*="background-size"]')).toBeNull();
});

function lastTextProps() {
  const calls = jest.mocked(SizableText).mock.calls;
  return calls[calls.length - 1][0];
}

function wrapperLayout(container: HTMLElement) {
  const wrapper = container.querySelector<HTMLElement>('[data-layout]');
  return JSON.parse(wrapper?.dataset.layout ?? '{}') as Record<string, unknown>;
}

it.each([false, true])(
  'draws native dashes as a text decoration in the first render (multiline=%s)',
  (multiline) => {
    platformEnv.isNative = true;
    const onTextLayout = jest.fn();
    const view = render(
      <DashText
        multiline={multiline}
        dashLength={3}
        dashGap={2}
        dashColor="$textSubdued"
        onTextLayout={onTextLayout}
      >
        Wrapped label
      </DashText>,
    );
    expect(jest.mocked(SizableText)).toHaveBeenCalledTimes(1);
    expect(lastTextProps()).toMatchObject({
      textDecorationLine: 'underline',
      textDecorationStyle: 'dashed',
      textDecorationColor: '$textSubdued',
      onekeyDashText: multiline ? '0.5,1,multiline' : '0.5,0,single',
    });
    expect(view.container.querySelectorAll('[data-layout]')).toHaveLength(1);
    expect(wrapperLayout(view.container).paddingBottom).toBe(0);
    expect(lastTextProps().paddingBottom).toBe(multiline ? 1.5 : 0.5);
    layoutText([{ x: 0, y: 0, width: 60, height: 14 }]);
    expect(onTextLayout).toHaveBeenCalledTimes(1);
  },
);

it('drops native decoration and reserved height for overlay and zero length', () => {
  platformEnv.isNative = true;
  const view = render(<DashText dashOverlay>Label</DashText>);
  expect(lastTextProps()).toMatchObject({
    textDecorationStyle: 'dashed',
    onekeyDashText: '0.5,0,overlay',
    paddingBottom: 0,
  });
  expect(wrapperLayout(view.container).paddingBottom).toBe(0);
  view.rerender(
    <DashText multiline length={0}>
      Label
    </DashText>,
  );
  expect(lastTextProps().textDecorationLine).toBeUndefined();
  expect(wrapperLayout(view.container).paddingBottom).toBe(0);
  view.rerender(<DashText dashThickness={0}>Label</DashText>);
  expect(lastTextProps().textDecorationLine).toBeUndefined();
  expect(lastTextProps()).not.toHaveProperty('onekeyDashText');
});

it.each([0.3, 1, 2])(
  'uses the requested native thickness on the first render (%s)',
  (dashThickness) => {
    platformEnv.isNative = true;
    const view = render(
      <DashText dashThickness={dashThickness}>Cost</DashText>,
    );
    expect(lastTextProps()).toMatchObject({
      onekeyDashText: `${dashThickness},0,single`,
      paddingBottom: dashThickness,
    });
    expect(lastTextProps().onTextLayout).toBeUndefined();
    expect(view.container.querySelectorAll('[data-layout]')).toHaveLength(1);
  },
);

it('keeps an explicit native dash count on each wrapped line', () => {
  platformEnv.isNative = true;
  const view = render(
    <DashText multiline length={1}>
      Label
    </DashText>,
  );
  layoutText([
    { x: 5, y: 0, width: 54, height: 14 },
    { x: 12, y: 14, width: 47, height: 14 },
  ]);

  expect(underlines(view.container)).toHaveLength(2);
  expect(
    underlines(view.container).map((line) => line.children.length),
  ).toEqual([1, 1]);
});

it('keeps an explicit native strike-through and draws the dash separately', () => {
  platformEnv.isNative = true;
  const view = render(
    <DashText multiline textDecorationLine="line-through">
      Label
    </DashText>,
  );
  layoutText([{ x: 0, y: 0, width: 40, height: 15 }]);

  expect(lastTextProps().textDecorationLine).toBe('line-through');
  expect(underlines(view.container)).toHaveLength(1);
});

it('keeps wrapped Android RTL labels on the native decoration path', () => {
  platformEnv.isNative = true;
  platformEnv.isNativeAndroid = true;
  I18nManager.isRTL = true;
  const onTextLayout = jest.fn();
  const view = render(
    <DashText multiline onTextLayout={onTextLayout}>
      שלום עולם
    </DashText>,
  );

  expect(lastTextProps().textDecorationLine).toBe('underline');

  layoutText([
    { x: 27, y: 0, width: 40, height: 15 },
    { x: 32, y: 15, width: 35, height: 15 },
  ]);

  expect(lastTextProps().textDecorationLine).toBe('underline');
  expect(underlines(view.container)).toHaveLength(0);
  expect(onTextLayout).toHaveBeenCalledTimes(1);
});

it('reuses native overlay lines when the caller changes the dash pattern', () => {
  platformEnv.isNative = true;
  const onTextLayout = jest.fn();
  const view = render(
    <DashText multiline dashOverlay onTextLayout={onTextLayout}>
      Label
    </DashText>,
  );
  const lines = [{ x: 12, y: 0, width: 24, height: 15 }];
  layoutText(lines);
  expect(underlines(view.container)).toHaveLength(0);

  view.rerender(
    <DashText multiline dashOverlay dashGap={3} onTextLayout={onTextLayout}>
      Label
    </DashText>,
  );

  const draws = underlines(view.container);
  expect(draws).toHaveLength(1);
  expect(JSON.parse(draws[0].dataset.layout ?? '{}')).toMatchObject({
    gap: 3,
    start: 12,
    top: 14.5,
    width: 24,
  });
  expect(onTextLayout).toHaveBeenCalledTimes(1);
  expect(onTextLayout).toHaveBeenCalledWith({ nativeEvent: { lines } });
});

it.each([
  [{ paddingBottom: 4 }, 0, 0],
  [{ paddingVertical: 4 }, 0, 4],
  [{ padding: 4 }, 4, 4],
  [{ pb: 4 }, 0, 0],
  [{ py: 4 }, 0, 4],
  [{ p: 4 }, 4, 4],
  [{ padding: 4, style: { paddingVertical: 6 } }, 4, 6],
] as const)(
  'positions multiline dashes inside the caller padding (%j)',
  (padding, left, top) => {
    platformEnv.isNative = true;
    const view = render(
      <DashText multiline {...padding}>
        Label
      </DashText>,
    );

    expect(lastTextProps()).toMatchObject(padding);
    expect(lastTextProps().textDecorationLine).toBeUndefined();
    expect(wrapperLayout(view.container).paddingBottom).toBe(1.5);
    layoutText([
      { x: 3, y: 0, width: 40, height: 15 },
      { x: 5, y: 15, width: 35, height: 15 },
    ]);
    expect(
      underlines(view.container).map(
        (line) =>
          JSON.parse(line.dataset.layout ?? '{}') as Record<string, unknown>,
      ),
    ).toMatchObject([
      { start: 3 + left, top: 16 + top, width: 40 },
      { start: 5 + left, top: 31 + top, width: 35 },
    ]);
  },
);

const percentagePaddingStyle = { padding: '10%' } as const;

it.each([
  [false, 'start'],
  [true, 'end'],
] as const)(
  'uses the padded text frame for measured dashes in RTL=%s',
  (rtl, horizontalProp) => {
    platformEnv.isNative = true;
    I18nManager.isRTL = rtl;
    const view = render(
      <DashText
        multiline
        dashOverlay
        dashGap={3}
        style={percentagePaddingStyle}
      >
        Label
      </DashText>,
    );
    const wrapperOnLayout = jest.mocked(YStack).mock.lastCall?.[0].onLayout;
    const textOnLayout = lastTextProps().onLayout;
    if (typeof wrapperOnLayout !== 'function' || !textOnLayout) {
      throw new OneKeyLocalError('Missing measured layout handlers');
    }
    void act(() => {
      wrapperOnLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 40 } },
      } as LayoutChangeEvent);
      textOnLayout({
        nativeEvent: { layout: { x: 2, y: 3, width: 80, height: 35 } },
      } as LayoutChangeEvent);
    });
    layoutText([{ x: 5, y: 0, width: 40, height: 15 }]);
    expect(
      JSON.parse(underlines(view.container)[0].dataset.layout ?? '{}'),
    ).toMatchObject({
      [horizontalProp]: 17,
      top: 27.5,
      width: 40,
    });
  },
);

it.each([{ dashLength: 4 }, { dashGap: 3 }])(
  'measures native dashes when only one pattern dimension changes (%j)',
  (pattern) => {
    platformEnv.isNative = true;
    const view = render(
      <DashText multiline {...pattern}>
        Label
      </DashText>,
    );
    expect(lastTextProps().textDecorationLine).toBeUndefined();
    layoutText([{ x: 0, y: 0, width: 12, height: 15 }]);

    const [line] = underlines(view.container);
    expect(line.children).toHaveLength(2);
    expect(JSON.parse(line.dataset.layout ?? '{}')).toMatchObject({
      gap: pattern.dashGap ?? 2,
    });
    expect(
      JSON.parse(line.firstElementChild?.getAttribute('data-layout') ?? '{}'),
    ).toMatchObject({ width: pattern.dashLength ?? 3 });
  },
);

it.each([false, true])(
  'fills a native label with fractional-period dashes (multiline=%s)',
  (multiline) => {
    platformEnv.isNative = true;
    const view = render(
      <DashText
        multiline={multiline}
        dashOverlay
        dashLength={0.5}
        dashGap={0.25}
      >
        Label
      </DashText>,
    );

    if (multiline) {
      layoutText([{ x: 0, y: 0, width: 120, height: 15 }]);
    } else {
      const handler = jest
        .mocked(YStack)
        .mock.calls.find(
          ([props]) => typeof props.onLayout === 'function',
        )?.[0].onLayout;
      if (typeof handler !== 'function') {
        throw new OneKeyLocalError('Missing native box layout handler');
      }
      void act(() =>
        handler({
          nativeEvent: { layout: { width: 120 } },
        } as LayoutChangeEvent),
      );
    }
    expect(underlines(view.container)[0].children).toHaveLength(160);

    view.rerender(
      <DashText multiline={multiline} dashOverlay dashLength={0} dashGap={0}>
        Label
      </DashText>,
    );
    expect(underlines(view.container)[0].children).toHaveLength(0);
  },
);

it('keeps a transparent Android dash invisible', () => {
  platformEnv.isNative = true;
  platformEnv.isNativeAndroid = true;
  const view = render(<DashText dashColor="transparent">Label</DashText>);

  expect(lastTextProps().textDecorationLine).toBeUndefined();
  expect(wrapperLayout(view.container).paddingBottom).toBe(0.5);
});

it('dashes only the trailing link on native, also when it wraps', () => {
  platformEnv.isNative = true;
  const onLayout = jest.fn();
  const label = (length: number) => (
    <DashText
      dashOverlay
      width={100}
      leadingText="Sign in to continue. "
      dashSpacing={2}
      length={length}
      onLayout={onLayout}
    >
      Learn more
    </DashText>
  );
  const view = render(label(0));
  const textProps = jest.mocked(SizableText);
  const layoutParagraph = (width: number) => {
    const callback = textProps.mock.calls
      .toReversed()
      .find(([props]) => props.opacity !== 0)?.[0].onLayout;
    if (typeof callback !== 'function') {
      throw new OneKeyLocalError('Missing paragraph layout handler');
    }
    void act(() =>
      callback({ nativeEvent: { layout: { width } } } as LayoutChangeEvent),
    );
  };
  const probeWidths = () =>
    textProps.mock.calls.slice(-2).map(([props]) => props.width);
  expect(textProps).toHaveBeenCalledTimes(1);
  layoutParagraph(100);
  expect(textProps.mock.calls.every(([props]) => props.opacity !== 0)).toBe(
    true,
  );
  // Lays out the paragraph (index 0) or a leading-text probe: plain (1) or
  // ending in a word joiner (2); one 20pt line per width.
  const layout = (probe: 0 | 1 | 2, ...widths: number[]) => {
    const call = jest
      .mocked(SizableText)
      .mock.calls.toReversed()
      .find(([p]) =>
        probe === 0
          ? p.opacity !== 0
          : p.opacity === 0 &&
            (Array.isArray(p.children) && p.children.includes('\u2060')) ===
              (probe === 2),
      );
    const lines = widths.map((width, i) => ({
      x: 0,
      y: i * 20,
      width,
      height: 20,
    }));
    const onTextLayout = call?.[0].onTextLayout;
    if (typeof onTextLayout === 'function') {
      void act(() =>
        onTextLayout({ nativeEvent: { lines } } as TextLayoutEvent),
      );
    }
  };
  const dashes = () =>
    underlines(view.container).map((node) => {
      const { start, top, width } = JSON.parse(node.dataset.layout ?? '{}');
      return [start, top, width] as number[];
    });

  // Enabling dashes does not send new layout events for the visible text.
  layout(0, 100, 90);
  view.rerender(label(50));
  expect(probeWidths()).toEqual([100, 100]);
  expect(onLayout).toHaveBeenCalledTimes(1);
  layout(1, 100, 40);
  layout(2, 100, 45);
  expect(dashes()).toEqual([[45, 39.5, 45]]);
  // The link wraps across two lines.
  layout(1, 80);
  layout(2, 85);
  layout(0, 100, 30);
  expect(dashes()).toEqual([
    [85, 19.5, 15],
    [0, 39.5, 30],
  ]);
  // The link alone on the next line while the joiner probe wraps earlier.
  layout(1, 100, 90);
  layout(2, 100, 70, 25);
  layout(0, 100, 90, 30);
  expect(dashes()).toEqual([[0, 59.5, 30]]);
  // A narrower paragraph must wait for its own prefix measurements.
  layoutParagraph(80);
  expect(probeWidths()).toEqual([80, 80]);
  layout(0, 80, 75, 65);
  expect(dashes()).toEqual([]);
  layout(1, 80, 45);
  layout(2, 80, 50);
  expect(dashes()).toEqual([
    [50, 39.5, 25],
    [0, 59.5, 65],
  ]);
});

it('keeps multiline labels in the requested tooltip and native popover', () => {
  const view = render(
    <DashText multiline tooltip="Explanation">
      Label
    </DashText>,
  );
  expect(screen.getByTestId('tooltip').textContent).toContain(
    'LabelExplanation',
  );
  platformEnv.isNative = true;
  view.rerender(
    <DashText multiline tooltip="Explanation">
      Label
    </DashText>,
  );
  expect(screen.getByTestId('popover').textContent).toContain(
    'LabelExplanation',
  );
});
