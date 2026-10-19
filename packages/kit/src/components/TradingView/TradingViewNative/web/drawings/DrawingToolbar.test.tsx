/** @jest-environment jsdom */

import { cloneElement, createElement, useRef } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

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
    children?: ReactNode;
  }) {
    const attributes = {
      'data-testid': testID,
      'aria-expanded': props['aria-expanded'],
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

function Toolbar({ coin }: { coin: string }) {
  const controller = useChartDrawings({
    enabled: false,
    projectionRef: useRef(null),
    redrawRef: useRef(() => undefined),
    rootRef: useRef(null),
    storageKey: coin,
  });
  return <DrawingToolbar controller={controller} mainChartBottomInset={0} />;
}

beforeEach(() => mockPreferences.clear());

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
