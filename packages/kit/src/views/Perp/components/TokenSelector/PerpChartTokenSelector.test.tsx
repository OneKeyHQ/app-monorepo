/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import { act, render } from '@testing-library/react';

import { PerpChartTokenSelector } from './PerpChartTokenSelector';

import type { LayoutChangeEvent } from 'react-native';

interface IMockPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderTrigger: ReactNode;
  renderContent: ReactNode;
}

let mockPopover: IMockPopoverProps | undefined;
let mockLayout: ((event: LayoutChangeEvent) => void) | undefined;
const mockContent = jest.fn<null, [{ bodyHeight?: number }]>(() => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => children,
  XStack: ({
    children,
    ref,
    testID,
  }: {
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
    testID?: string;
  }) => (
    <div ref={ref} data-testid={testID}>
      {children}
    </div>
  ),
  YStack: ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
  }) => {
    mockLayout = onLayout;
    return children;
  },
  Popover: (props: IMockPopoverProps) => {
    mockPopover = props;
    return (
      <>
        {props.renderTrigger}
        {props.open ? props.renderContent : null}
      </>
    );
  },
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: () => undefined,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { setTokenSelectorOpen: () => undefined },
  }),
}));

jest.mock('../../hooks', () => ({
  usePrewarmPerpsTokenSelectorImages: () => () => undefined,
}));

jest.mock('./PerpTokenSelector', () => ({
  DESKTOP_TOKEN_SELECTOR_BODY_HEIGHT: 440,
  DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH: 800,
  PerpTokenSelectorContent: (props: { bodyHeight?: number }) =>
    mockContent(props),
}));

// What the popover holds besides the list: search, tabs and key hints. A bit
// more than the picker guesses before it measures.
const CHROME_HEIGHT = 170;

function getBodyHeight() {
  return mockContent.mock.calls.at(-1)?.[0].bodyHeight;
}

// Reports the popover content's height for the list it was given.
function layOut() {
  const bodyHeight = getBodyHeight() ?? 0;
  act(() =>
    mockLayout?.({
      nativeEvent: { layout: { height: CHROME_HEIGHT + bodyHeight } },
    } as LayoutChangeEvent),
  );
}

function openAt(rect: { top: number; bottom: number }, windowHeight: number) {
  const view = render(
    <PerpChartTokenSelector
      display={{ label: 'ETHUSDC', tokenImageUri: 'eth.png' }}
      testID="picker"
    />,
  );
  jest
    .spyOn(view.getByTestId('picker'), 'getBoundingClientRect')
    .mockReturnValue({
      x: 0,
      y: rect.top,
      left: 0,
      right: 120,
      width: 120,
      height: rect.bottom - rect.top,
      ...rect,
      toJSON: () => rect,
    });
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    value: windowHeight,
  });
  act(() => mockPopover?.onOpenChange(true));
  return view;
}

beforeEach(() => {
  mockPopover = undefined;
  mockLayout = undefined;
  mockContent.mockClear();
});

it.each([
  // Room below the header of a panel at the top: the whole list.
  ['below a header near the top', { top: 100, bottom: 128 }, 1000, 440],
  // A header low on the page opens upwards, with the whole list.
  ['above a header near the bottom', { top: 700, bottom: 728 }, 800, 440],
  // Neither side has room for it all: the list gives way, so nothing is cut.
  ['in a short window', { top: 400, bottom: 428 }, 800, 400 - 20 - 170],
  // It keeps a few rows however short the window.
  ['in a tiny window', { top: 200, bottom: 228 }, 400, 200],
])(
  'fits the token list to the roomier side %s',
  (_, rect, windowHeight, expected) => {
    openAt(rect, windowHeight);
    expect(mockPopover?.open).toBe(true);

    layOut();
    layOut();

    expect(getBodyHeight()).toBe(expected);
  },
);
