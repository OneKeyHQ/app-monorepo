/** @jest-environment jsdom */
import type { PropsWithChildren, ReactElement } from 'react';
import { forwardRef, useImperativeHandle } from 'react';

import { act, render } from '@testing-library/react';

import type { IDustSweepToken } from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepSelection } from './DustSweepSelection';

import type { IDustSweepState } from '../stateMachine';

type ILayoutHandler = (event: {
  nativeEvent: { layout: { y: number; height: number } };
}) => void;

const mockScrollTo = jest.fn();
// Row layout handlers, keyed by the token rendered inside each row.
const mockRowLayouts = new Map<string, ILayoutHandler>();
let mockModel: Record<string, unknown>;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  function MockBox({ children }: PropsWithChildren) {
    return <div>{children}</div>;
  }
  function MockStack({
    children,
    onLayout,
  }: PropsWithChildren<{ onLayout?: ILayoutHandler }>) {
    const rowToken = (children as ReactElement<{ token?: { key: string } }>)
      ?.props?.token;
    if (onLayout && rowToken) mockRowLayouts.set(rowToken.key, onLayout);
    return <div>{children}</div>;
  }
  const MockScrollView = forwardRef<unknown, PropsWithChildren>(
    ({ children }, ref) => {
      useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return <div>{children}</div>;
    },
  );
  MockScrollView.displayName = 'MockScrollView';
  return {
    Button: MockBox,
    Checkbox: () => null,
    Illustration: () => null,
    ScrollView: MockScrollView,
    SizableText: MockBox,
    Stack: MockStack,
    XStack: MockBox,
    YStack: MockBox,
  };
});
jest.mock('@onekeyhq/kit/src/views/Swap/utils/swapDesktopCardShadow', () => ({
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE: {},
}));
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => mockModel,
}));
jest.mock('./DustSweepFilters', () => ({ DustSweepFilters: () => null }));
jest.mock('./DustSweepSummary', () => ({ DUST_SWEEP_ACTION_HEIGHT: 46 }));
jest.mock('./DustSweepTokenRow', () => ({ DustSweepTokenRow: () => null }));

function token(key: string) {
  return { key } as IDustSweepToken;
}
function sweep(keys: string[], activeKey: string) {
  const items = keys.map((key) => ({
    token: token(key),
    status: key === activeKey ? 'signing' : 'waiting',
  }));
  mockModel = {
    visible: [],
    hidden: [],
    selected: [],
    selecting: false,
    session: {
      state: { phase: 'running', items } as unknown as IDustSweepState,
    },
    loadStatus: 'ready',
    refreshStatus: 'idle',
    assetStatus: 'ready',
    partialError: false,
  };
}
function layoutRow(key: string, y: number) {
  act(() =>
    mockRowLayouts.get(key)?.({ nativeEvent: { layout: { y, height: 60 } } }),
  );
}

it('scrolls a new sweep to the active row by its current layout, not a previous list', () => {
  sweep(['a', 'b', 'c'], 'a');
  const view = render(<DustSweepSelection desktop />);
  layoutRow('a', 0);
  layoutRow('b', 100);
  layoutRow('c', 200);

  // A different list whose active row sits where "c" used to be.
  mockScrollTo.mockClear();
  sweep(['d', 'e', 'f'], 'f');
  view.rerender(<DustSweepSelection desktop />);
  layoutRow('d', 0);
  layoutRow('e', 60);
  layoutRow('f', 120);

  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 120, animated: true });
  expect(mockScrollTo).not.toHaveBeenCalledWith({ y: 200, animated: true });
});

it('follows the active row as the sweep moves on', () => {
  sweep(['a', 'b'], 'a');
  const view = render(<DustSweepSelection desktop />);
  layoutRow('a', 0);
  layoutRow('b', 100);
  mockScrollTo.mockClear();

  sweep(['a', 'b'], 'b');
  view.rerender(<DustSweepSelection desktop />);
  expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 100, animated: true });
});
