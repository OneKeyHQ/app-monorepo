/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { CSSProperties, ReactNode } from 'react';
import { isValidElement } from 'react';

import { DashText } from '.';

import { act, render, screen } from '@testing-library/react';
import { I18nManager } from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SizableText } from '../../primitives/SizeableText';

import type { ISizableTextProps } from '../../primitives';
import type { TextLayoutEvent } from 'react-native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-native', () => ({ I18nManager: { isRTL: false } }));
jest.mock('../../hooks/useStyle', () => ({ useMedia: () => ({ gtMd: true }) }));
jest.mock('../../shared/tamagui', () => ({
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
  return { XStack: Box, YStack: Box };
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

it.each([false, true])(
  'positions native fragments at physical x with RTL=%s and updates after reflow',
  (rtl) => {
    platformEnv.isNative = true;
    I18nManager.isRTL = rtl;
    const onTextLayout = jest.fn();
    const view = render(
      <DashText
        multiline
        length={1}
        dashThickness={2}
        dashSpacing={3}
        onTextLayout={onTextLayout}
      >
        Wrapped label
      </DashText>,
    );
    layoutText([
      { x: 7, y: 0, width: 60, height: 20 },
      { x: 30, y: 20, width: 25, height: 20 },
    ]);
    const lines = underlines(view.container);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0].dataset.layout ?? '{}')).toMatchObject({
      [rtl ? 'end' : 'start']: 7,
      top: 23,
      width: 60,
    });
    expect(
      JSON.parse(lines[0].dataset.layout ?? '{}')[rtl ? 'start' : 'end'],
    ).toBeUndefined();
    expect(lines[0].children).toHaveLength(1);
    expect(lines[1].children).toHaveLength(1);
    expect(onTextLayout).toHaveBeenCalledTimes(1);
    layoutText([{ x: 0, y: 0, width: 90, height: 20 }]);
    expect(underlines(view.container)).toHaveLength(1);
    expect(
      JSON.parse(underlines(view.container)[0].dataset.layout ?? '{}').width,
    ).toBe(90);
  },
);

it('caps native dash allocation to line width and supports overlay and zero length', () => {
  platformEnv.isNative = true;
  const view = render(
    <DashText multiline dashOverlay dashThickness={2}>
      Label
    </DashText>,
  );
  layoutText([{ x: 0, y: 10, width: 12, height: 20 }]);
  const line = underlines(view.container)[0];
  expect(line.children).toHaveLength(3);
  expect(JSON.parse(line.dataset.layout ?? '{}').top).toBe(28);
  view.rerender(
    <DashText multiline length={0}>
      Label
    </DashText>,
  );
  expect(underlines(view.container)).toHaveLength(0);
});

it('dashes only the trailing link on native, also when it wraps', () => {
  platformEnv.isNative = true;
  const view = render(
    <DashText leadingText="Sign in to continue. " dashSpacing={2} length={50}>
      Learn more
    </DashText>,
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

  // Same line as the sentence end, starting after the space.
  layout(1, 100, 40);
  layout(2, 100, 45);
  layout(0, 100, 90);
  expect(dashes()).toEqual([[45, 42, 45]]);
  // The link wraps across two lines.
  layout(1, 80);
  layout(2, 85);
  layout(0, 100, 30);
  expect(dashes()).toEqual([
    [85, 22, 15],
    [0, 42, 30],
  ]);
  // The link alone on the next line while the joiner probe wraps earlier.
  layout(1, 100, 90);
  layout(2, 100, 70, 25);
  layout(0, 100, 90, 30);
  expect(dashes()).toEqual([[0, 62, 30]]);
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
