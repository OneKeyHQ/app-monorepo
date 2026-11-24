/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
/* cspell:ignore שלום עולם */
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
jest.mock('react-native', () => ({
  I18nManager: { isRTL: false },
  processColor: (color: string) =>
    color === 'transparent' ? 0 : 0xff_88_88_88,
}));
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
        dashColor="$textSubdued"
        dashThickness={2}
        dashSpacing={3}
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
      onTextLayout,
    });
    // No measured dash views: the wrapper only reserves the old rule height.
    expect(view.container.querySelectorAll('[data-layout]')).toHaveLength(1);
    expect(wrapperLayout(view.container).paddingBottom).toBe(multiline ? 5 : 2);
  },
);

it('drops native decoration and reserved height for overlay and zero length', () => {
  platformEnv.isNative = true;
  const view = render(
    <DashText dashOverlay dashThickness={2}>
      Label
    </DashText>,
  );
  expect(lastTextProps().textDecorationStyle).toBe('dashed');
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
});

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

it('uses both physical line widths for wrapped Android RTL labels', () => {
  platformEnv.isNative = true;
  platformEnv.isNativeAndroid = true;
  I18nManager.isRTL = true;
  const view = render(<DashText multiline>שלום עולם</DashText>);
  layoutText([
    { x: 27, y: 0, width: 40, height: 15 },
    { x: 32, y: 15, width: 35, height: 15 },
  ]);

  expect(lastTextProps().textDecorationLine).toBeUndefined();
  expect(
    underlines(view.container).map(
      (line) => JSON.parse(line.dataset.layout ?? '{}') as unknown,
    ),
  ).toEqual([
    expect.objectContaining({ end: 27, width: 40 }),
    expect.objectContaining({ end: 32, width: 35 }),
  ]);
});

it('keeps a transparent Android dash invisible', () => {
  platformEnv.isNative = true;
  platformEnv.isNativeAndroid = true;
  const view = render(<DashText dashColor="transparent">Label</DashText>);

  expect(lastTextProps().textDecorationLine).toBeUndefined();
  expect(wrapperLayout(view.container).paddingBottom).toBe(0.5);
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
