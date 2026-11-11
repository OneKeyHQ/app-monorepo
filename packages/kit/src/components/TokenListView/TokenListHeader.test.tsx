/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenListHeader } from './TokenListHeader';

let mockGtMd = true;
let mockLayoutEngine: 'web' | 'native' = 'web';
let mockSort = { sortType: 'value', sortDirection: 'desc' };

// Jest resolves the web platform file; route the header layout through the
// real web or native implementation per test so both contracts are exercised
// against one React instance.
jest.mock('./tokenListRowLayout', () => {
  const web = jest.requireActual<typeof import('./tokenListRowLayout')>(
    './tokenListRowLayout',
  );
  const native = jest.requireActual<
    typeof import('./tokenListRowLayout.native')
  >('./tokenListRowLayout.native');
  return {
    ...web,
    getTokenListHeaderLayout: (gtMd: boolean) =>
      (mockLayoutEngine === 'native' ? native : web).getTokenListHeaderLayout(
        gtMd,
      ),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const layoutProps = [
    'width',
    'ml',
    'px',
    'gap',
    'flex',
    'flexGrow',
    'opacity',
  ] as const;
  const box = (kind: string) => {
    const MockBox = ({
      children,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) => {
      const attrs: Record<string, string> = { 'data-kind': kind };
      layoutProps.forEach((key) => {
        if (props[key] !== undefined)
          attrs[`data-${key.replace('flexGrow', 'flex-grow')}`] = String(
            props[key],
          );
      });
      if (props['aria-hidden']) attrs['aria-hidden'] = 'true';
      return React.createElement('div', attrs, children);
    };
    MockBox.displayName = `Mock${kind}`;
    return MockBox;
  };
  return {
    Icon: ({ name }: { name: string }) =>
      React.createElement('i', { 'data-icon': name }),
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
  TOKEN_LIST_DEFAULT_SORT: { sortType: 'value', sortDirection: 'desc' },
  useTokenListSortAtom: () => [mockSort],
  useTokenListActions: () => ({
    current: { updateTokenListSort: jest.fn() },
  }),
}));

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
    columnWeights: Array.from(columns.children).map(
      (column) => (column as HTMLElement).dataset.flexGrow,
    ),
    columnLabels: Array.from(columns.children).map(
      (column) => column.textContent,
    ),
    assetInset: assetWrap?.dataset.ml,
    swapPlaceholderPx: swapPlaceholder?.dataset.px,
  };
}

describe('TokenListHeader table geometry', () => {
  beforeEach(() => {
    mockLayoutEngine = 'web';
    mockGtMd = true;
  });

  it('renders nothing outside table layout', () => {
    const { container } = render(<TokenListHeader withSwapAction />);
    expect(container.innerHTML).toBe('');
  });

  it('mirrors the web data row on wide layouts', () => {
    render(<TokenListHeader tableLayout withSwapAction />);
    // Web rows end on the holdings and keep no Swap spacer column.
    expect(readHeaderGeometry()).toEqual({
      gap: '12',
      mx: '0',
      px: '12',
      leadingWidth: '32',
      columnGap: '12',
      columnCount: 3,
      columnWeights: ['2', '3', '3'],
      columnLabels: ['global.asset', 'global.price', 'global.balance'],
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
      columnWeights: ['1', '1', '1'],
      swapPlaceholderPx: undefined,
    });
  });

  it('keeps the native row geometry', () => {
    mockLayoutEngine = 'native';
    const wasNative = platformEnv.isNative;
    platformEnv.isNative = true;
    try {
      render(<TokenListHeader tableLayout withSwapAction />);
      expect(readHeaderGeometry()).toEqual({
        gap: '8',
        mx: undefined,
        px: undefined,
        leadingWidth: '44',
        columnGap: '8',
        columnCount: 4,
        columnWeights: ['2', '3', '3', '2'],
        columnLabels: ['global.asset', 'global.balance', 'global.price', ''],
        assetInset: '-52',
        swapPlaceholderPx: '11',
      });
    } finally {
      platformEnv.isNative = wasNative;
    }
  });
});

describe('TokenListHeader sort arrow', () => {
  beforeEach(() => {
    mockLayoutEngine = 'web';
    mockGtMd = true;
    mockSort = { sortType: 'value', sortDirection: 'desc' };
  });

  const readArrows = () =>
    Array.from(
      screen
        .getByTestId('Wallet-Token-List-Header')
        .querySelectorAll('[data-icon]'),
    ).map((icon) => ({
      name: icon.getAttribute('data-icon'),
      opacity: icon.parentElement?.getAttribute('data-opacity'),
    }));

  it('shows no arrow in the opening order, only on hover', () => {
    render(<TokenListHeader tableLayout withSwapAction />);
    // Balance is high to low already; the others would start that way.
    expect(readArrows()).toEqual([
      { name: 'ChevronDownSmallOutline', opacity: '0' },
      { name: 'ChevronDownSmallOutline', opacity: '0' },
      { name: 'ChevronDownSmallOutline', opacity: '0' },
    ]);
  });

  it('turns the arrow over when the sorted column flips', () => {
    mockSort = { sortType: 'value', sortDirection: 'asc' };
    render(<TokenListHeader tableLayout withSwapAction />);
    // Asset | price | balance: the balance arrow is the last one.
    expect(readArrows()).toEqual([
      { name: 'ChevronDownSmallOutline', opacity: '0' },
      { name: 'ChevronDownSmallOutline', opacity: '0' },
      { name: 'ChevronTopSmallOutline', opacity: '1' },
    ]);
  });

  it('marks the column the user sorted by', () => {
    mockSort = { sortType: 'price', sortDirection: 'asc' };
    render(<TokenListHeader tableLayout withSwapAction />);
    const arrows = readArrows();
    expect(arrows.filter((arrow) => arrow.opacity === '1')).toEqual([
      { name: 'ChevronTopSmallOutline', opacity: '1' },
    ]);
    expect(arrows.filter((arrow) => arrow.opacity === '0')).toEqual([
      { name: 'ChevronDownSmallOutline', opacity: '0' },
      { name: 'ChevronDownSmallOutline', opacity: '0' },
    ]);
  });
});
