/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenListHeader } from './TokenListHeader';

let mockGtMd = true;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const layoutProps = ['width', 'ml', 'px', 'gap', 'flex'] as const;
  const box = (kind: string) => {
    const MockBox = ({
      children,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) => {
      const attrs: Record<string, string> = { 'data-kind': kind };
      layoutProps.forEach((key) => {
        if (props[key] !== undefined) attrs[`data-${key}`] = String(props[key]);
      });
      if (props['aria-hidden']) attrs['aria-hidden'] = 'true';
      return React.createElement('div', attrs, children);
    };
    MockBox.displayName = `Mock${kind}`;
    return MockBox;
  };
  return {
    Icon: () => null,
    SizableText: box('text'),
    Stack: box('stack'),
    XStack: box('xstack'),
    useMedia: () => ({ gtMd: mockGtMd }),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListItem: ({
      children,
      testID,
      gap,
      mx,
      px,
    }: {
      children?: ReactNode;
      testID?: string;
      gap?: unknown;
      mx?: unknown;
      px?: unknown;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': testID,
          'data-gap': String(gap),
          'data-mx': mx === undefined ? undefined : String(mx),
          'data-px': px === undefined ? undefined : String(px),
        },
        children,
      ),
  };
});
jest.mock('../../states/jotai/contexts/tokenList', () => ({
  useTokenListSortAtom: () => [{ sortType: 'value', sortDirection: 'desc' }],
  useTokenListActions: () => ({
    current: { updateTokenListSort: jest.fn() },
  }),
}));

const env = platformEnv as unknown as { isNative: boolean };

function readHeaderGeometry() {
  const header = screen.getByTestId('Wallet-Token-List-Header');
  const leading = header.firstElementChild as HTMLElement | null;
  const columns = header.querySelector('[data-flex="1"]') as HTMLElement;
  const assetWrap = columns.querySelector('[data-ml]') as HTMLElement | null;
  const swapPlaceholder = header.querySelector(
    '[aria-hidden="true"]',
  ) as HTMLElement | null;
  return {
    gap: header.dataset.gap,
    mx: header.dataset.mx,
    px: header.dataset.px,
    leadingWidth: leading?.dataset.width,
    columnGap: columns.dataset.gap,
    columnCount: columns.children.length,
    assetInset: assetWrap?.dataset.ml,
    swapPlaceholderPx: swapPlaceholder?.dataset.px,
  };
}

describe('TokenListHeader table geometry', () => {
  beforeEach(() => {
    env.isNative = false;
    mockGtMd = true;
  });

  it('renders nothing outside table layout', () => {
    const { container } = render(<TokenListHeader withSwapAction />);
    expect(container.innerHTML).toBe('');
  });

  it('mirrors the web data row on wide layouts', () => {
    render(<TokenListHeader tableLayout withSwapAction />);
    expect(readHeaderGeometry()).toEqual({
      gap: '12',
      mx: '0',
      px: '12',
      leadingWidth: '32',
      columnGap: '12',
      columnCount: 3,
      assetInset: '-44',
      swapPlaceholderPx: '11',
    });
  });

  it('follows the 40px icon below the gtMd breakpoint', () => {
    mockGtMd = false;
    render(<TokenListHeader tableLayout withSwapAction />);
    expect(readHeaderGeometry()).toMatchObject({
      leadingWidth: '40',
      assetInset: '-52',
    });
  });

  it('drops the swap placeholder when rows have no swap action', () => {
    render(<TokenListHeader tableLayout />);
    expect(readHeaderGeometry()).toMatchObject({
      columnCount: 3,
      swapPlaceholderPx: undefined,
    });
  });

  it('keeps the native row geometry', () => {
    env.isNative = true;
    render(<TokenListHeader tableLayout withSwapAction />);
    expect(readHeaderGeometry()).toEqual({
      gap: '8',
      mx: undefined,
      px: undefined,
      leadingWidth: '44',
      columnGap: '8',
      columnCount: 3,
      assetInset: '-52',
      swapPlaceholderPx: '11',
    });
  });
});
