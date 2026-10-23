/** @jest-environment jsdom */

import { cloneElement, createElement, useRef } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { DrawingToolbar } from './DrawingToolbar';
import { useChartDrawings } from './useChartDrawings';

const mockPreferences = new Map<string, unknown>();

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    syncStorage: {
      getBoolean: (key: string) => mockPreferences.get(key),
      set: (key: string, value: unknown) => mockPreferences.set(key, value),
    },
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function Box({
    children,
    render: element,
    testID,
    onPress,
    ...props
  }: HTMLAttributes<HTMLElement> & {
    render?: ReactElement<HTMLAttributes<HTMLElement>> | string;
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    opacity?: number;
    children?: ReactNode;
  }) {
    const attributes = {
      'data-testid': testID,
      'aria-expanded': props['aria-expanded'],
      'aria-label': props['aria-label'],
      role: props.role,
      disabled: props.disabled,
      style: { ...props.style, opacity: props.opacity },
      onClick: onPress,
    };
    if (typeof element === 'string') {
      return createElement(element, attributes, children);
    }
    return element ? (
      cloneElement(element, attributes, children)
    ) : (
      <div {...attributes}>{children}</div>
    );
  }
  return {
    Button: Box,
    ButtonFrame: Box,
    IconButton: Box,
    ScrollView: Box,
    SizableText: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    Icon: () => null,
    useTheme: () => ({
      iconActive: { val: '#fff' },
      iconSubdued: { val: '#888' },
    }),
  };
});

function Toolbar({
  coin,
  enabled = false,
}: {
  coin: string;
  enabled?: boolean;
}) {
  const controller = useChartDrawings({
    enabled,
    projectionRef: useRef(null),
    redrawRef: useRef(() => undefined),
    rootRef: useRef(null),
    storageKey: coin,
  });
  return <DrawingToolbar controller={controller} mainChartBottomInset={0} />;
}

beforeEach(() => {
  mockPreferences.clear();
  jest.mocked(appStorage.getItem).mockResolvedValue(null);
});

it('restores the collapsed toolbar before rendering a different symbol or interval', () => {
  const first = render(<Toolbar key="BTC:60" coin="BTC" />);
  fireEvent.click(screen.getByTestId('chart-drawing-toolbar-toggle'));
  expect(
    screen.getByTestId('chart-drawing-toolbar').getAttribute('data-collapsed'),
  ).toBe('true');

  first.rerender(<Toolbar key="ETH:60" coin="ETH" />);
  expect(
    screen.getByTestId('chart-drawing-toolbar').getAttribute('data-collapsed'),
  ).toBe('true');

  first.rerender(<Toolbar key="ETH:15" coin="ETH" />);
  expect(
    screen.getByTestId('chart-drawing-toolbar').getAttribute('data-collapsed'),
  ).toBe('true');

  fireEvent.click(screen.getByTestId('chart-drawing-toolbar-toggle'));
  first.unmount();
  render(<Toolbar coin="BTC" />);
  expect(
    screen.getByTestId('chart-drawing-toolbar').getAttribute('data-collapsed'),
  ).toBe('false');
});

it('keeps drawing tool icons at full opacity while another coin restores its drawings', async () => {
  const { rerender } = render(<Toolbar key="BTC" coin="BTC" enabled />);
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Trend Line' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  let resolveDrawings: (value: string | null) => void = () => undefined;
  const pendingDrawings = new Promise<string | null>((resolve) => {
    resolveDrawings = resolve;
  });
  jest.spyOn(appStorage, 'getItem').mockReturnValue(pendingDrawings);

  rerender(<Toolbar key="ETH" coin="ETH" enabled />);
  for (const name of [
    'Trend Line',
    'Fib Retracement',
    'XABCD Pattern',
    'Price Range',
    'Rectangle',
    'Text',
    'Emojis',
    'Measure',
  ]) {
    for (const button of screen.getAllByRole('button', { name })) {
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(getComputedStyle(button).opacity).toBe('1');
    }
  }
  const undo = screen.getByRole('button', { name: /Undo drawing/ });
  expect(undo.hasAttribute('disabled')).toBe(true);
  expect(getComputedStyle(undo).opacity).toBe('0.3');

  await act(async () => resolveDrawings(null));
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Trend Line' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  expect(
    getComputedStyle(screen.getByRole('button', { name: 'Trend Line' }))
      .opacity,
  ).toBe('1');
});
