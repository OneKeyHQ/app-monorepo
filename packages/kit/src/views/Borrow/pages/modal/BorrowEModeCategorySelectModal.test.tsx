/** @jest-environment jsdom */
/* eslint-disable import/first */

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 0.33 } }));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id}(${JSON.stringify(values)})` : id,
  }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, property) => property }),
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  __esModule: true,
  EModalStakingRoutes: {
    BorrowEModeCategorySelect: 'BorrowEModeCategorySelect',
  },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const media = { gtMd: true };
  (globalThis as Record<string, unknown>).__eModeSelectMedia = media;

  type IMockProps = Record<string, unknown> & { children?: React.ReactNode };

  const asDom = (tag: string) => {
    function MockStack({
      children,
      testID,
      onPress,
      name,
      ...rest
    }: IMockProps) {
      return React.createElement(
        tag,
        {
          'data-testid': testID,
          'data-icon': name,
          'data-opacity': rest.opacity,
          onClick: onPress,
        },
        children,
      );
    }
    MockStack.displayName = `MockStack(${tag})`;
    return MockStack;
  };

  function MockPage({ children }: IMockProps) {
    return React.createElement('div', null, children);
  }
  MockPage.displayName = 'MockPage';
  function MockPageHeader({ title }: { title?: string }) {
    return React.createElement('h1', null, title);
  }
  MockPageHeader.displayName = 'MockPageHeader';
  function MockPageBody({ children }: IMockProps) {
    return React.createElement('div', null, children);
  }
  MockPageBody.displayName = 'MockPageBody';
  MockPage.Header = MockPageHeader;
  MockPage.Body = MockPageBody;

  return {
    __esModule: true,
    Badge: asDom('span'),
    Icon: asDom('i'),
    Page: MockPage,
    SizableText: asDom('span'),
    Stack: asDom('div'),
    XStack: asDom('div'),
    YStack: asDom('div'),
    useMedia: () => media,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  __esModule: true,
  TokenGroup: ({ tokens }: { tokens: { tokenImageUri?: string }[] }) => (
    <span data-tokens={tokens.map((t) => t.tokenImageUri).join(',')} />
  ),
}));

const pop = jest.fn();
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: (globalThis as Record<string, any>).__eModePop }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  __esModule: true,
  useAppRoute: () => ({
    params: (globalThis as Record<string, any>).__eModeRouteParams,
  }),
}));

import { fireEvent, render } from '@testing-library/react';

import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import BorrowEModeCategorySelectModal from './BorrowEModeCategorySelectModal';

const media = (globalThis as Record<string, any>).__eModeSelectMedia as {
  gtMd: boolean;
};

function token(symbol: string) {
  return {
    address: `0x${symbol}`,
    decimals: 18,
    isNative: false,
    logoURI: `${symbol}.png`,
    name: symbol,
    symbol,
  };
}

const eModeStatus: IBorrowEModeStatus = {
  eModeId: 1,
  originalLtv: '80',
  categories: [
    {
      eModeId: 1,
      label: 'stablecoins',
      ltv: '93',
      disabled: false,
      assets: [
        {
          reserveAddress: '0xusdc',
          token: token('USDC'),
          boostedLTV: true,
          borrowable: true,
        },
        {
          reserveAddress: '0xusdt',
          token: token('USDT'),
          boostedLTV: true,
          borrowable: false,
        },
      ],
    },
    {
      eModeId: 3,
      label: 'wide',
      ltv: '91',
      disabled: false,
      assets: ['A', 'B', 'C', 'D', 'E', 'F'].map((symbol) => ({
        reserveAddress: `0x${symbol}`,
        token: token(symbol),
        boostedLTV: true,
        borrowable: true,
      })),
    },
    {
      eModeId: 2,
      label: 'eth_correlated',
      ltv: '90',
      disabled: true,
      canSwitch: false,
      assets: [
        {
          reserveAddress: '0xweth',
          token: token('WETH'),
          boostedLTV: true,
          borrowable: false,
        },
      ],
    },
  ],
} as IBorrowEModeStatus;

function renderModal({
  selectedEModeId = 1,
  onSelect = jest.fn(),
}: { selectedEModeId?: number | null; onSelect?: jest.Mock } = {}) {
  (globalThis as Record<string, any>).__eModeRouteParams = {
    eModeStatus,
    selectedEModeId,
    onSelect,
  };
  (globalThis as Record<string, any>).__eModePop = pop;
  return { onSelect, ...render(<BorrowEModeCategorySelectModal />) };
}

const rowOf = (container: HTMLElement, eModeId: number) =>
  container.querySelector(
    `[data-testid="borrow-e-mode-category-row-${eModeId}"]`,
  ) as HTMLElement;

describe('BorrowEModeCategorySelectModal', () => {
  beforeEach(() => {
    pop.mockClear();
    media.gtMd = true;
  });

  it('lists the synthetic Off row ahead of every backend category', () => {
    const { container } = renderModal();

    expect(
      Array.from(
        container.querySelectorAll(
          '[data-testid^="borrow-e-mode-category-row-"]',
        ),
      ).map((node) => node.getAttribute('data-testid')),
    ).toEqual([
      'borrow-e-mode-category-row-0',
      'borrow-e-mode-category-row-1',
      'borrow-e-mode-category-row-3',
      'borrow-e-mode-category-row-2',
    ]);
  });

  it('splits the category assets by the capability each flag actually grants', () => {
    const { container } = renderModal();
    const groups = Array.from(
      rowOf(container, 1).querySelectorAll('[data-tokens]'),
    ).map((node) => node.getAttribute('data-tokens'));

    // USDT is boosted collateral but not borrowable, so it must not appear in
    // the borrowable group.
    expect(groups).toEqual(['USDC.png,USDT.png', 'USDC.png']);
  });

  it('spells out an empty capability instead of leaving the slot blank', () => {
    const { container } = renderModal();
    const row = rowOf(container, 2);

    expect(
      Array.from(row.querySelectorAll('[data-tokens]')).map((node) =>
        node.getAttribute('data-tokens'),
      ),
    ).toEqual(['WETH.png']);
    expect(row.textContent).toContain('-');
  });

  it('shows no capability rows on the Off row, which covers no category', () => {
    const { container } = renderModal();
    const off = rowOf(container, 0);

    expect(off.querySelectorAll('[data-tokens]')).toHaveLength(0);
    expect(off.textContent).not.toContain('defi_collateral');
  });

  it('keeps Max LTV as the subtitle and moves the active marker to a badge', () => {
    const { container } = renderModal();

    // The Off row carries the market LTV before any boost, so it stays
    // comparable.
    expect(rowOf(container, 0).textContent).toContain(
      'defi_emode_max_ltv({"ltv":"80"})',
    );
    expect(rowOf(container, 1).textContent).toContain(
      'defi_emode_max_ltv({"ltv":"93"})',
    );
    expect(rowOf(container, 1).textContent).toContain('global_current');
    expect(rowOf(container, 0).textContent).not.toContain('global_current');
  });

  it('flags a category that cannot be switched into yet', () => {
    const { container } = renderModal();

    expect(rowOf(container, 2).textContent).toContain('defi_emode_need_action');
  });

  it('reports the pick and closes itself', () => {
    const { container, onSelect } = renderModal();

    fireEvent.click(rowOf(container, 0));

    expect(onSelect).toHaveBeenCalledWith(0);
    expect(pop).toHaveBeenCalledTimes(1);
  });

  it('does not let a disabled category be picked', () => {
    const { container, onSelect } = renderModal();

    fireEvent.click(rowOf(container, 2));

    expect(onSelect).not.toHaveBeenCalled();
    expect(pop).not.toHaveBeenCalled();
  });

  // TokenGroup's built-in badge is a rounded rect tucked under round avatars,
  // so the remainder is sliced off here and spelled as text instead.
  it('caps the avatars and spells the remainder as text', () => {
    const { container, unmount } = renderModal();
    const wide = rowOf(container, 3);

    expect(
      wide.querySelector('[data-tokens]')?.getAttribute('data-tokens'),
    ).toBe('A.png,B.png,C.png,D.png');
    expect(wide.textContent).toContain('+2');
    unmount();

    // 320px cannot fit the Russian label next to four avatars, so phones drop
    // one and the remainder absorbs it.
    media.gtMd = false;
    const phone = renderModal();
    const phoneWide = rowOf(phone.container, 3);

    expect(
      phoneWide.querySelector('[data-tokens]')?.getAttribute('data-tokens'),
    ).toBe('A.png,B.png,C.png');
    expect(phoneWide.textContent).toContain('+3');
  });

  it('leaves no remainder when the category fits', () => {
    const { container } = renderModal();

    expect(rowOf(container, 1).textContent).not.toMatch(/\+\d/);
  });

  // The capability labels are wide enough to push the category name off a phone
  // row, so they move under the subtitle rather than being dropped.
  it('keeps both capability rows on narrow screens', () => {
    media.gtMd = false;
    const { container } = renderModal();
    const row = rowOf(container, 1);

    expect(row.textContent).toContain('defi_collateral');
    expect(row.textContent).toContain('defi_borrowable');
    expect(row.querySelectorAll('[data-tokens]')).toHaveLength(2);
  });
});
