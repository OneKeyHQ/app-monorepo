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
  };
});

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
      ],
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
      'borrow-e-mode-category-row-2',
    ]);
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

  // Which assets a category covers is shown by EModeAssetsTable once a category
  // is picked, so the rows deliberately carry no asset list of their own.
  it('leaves the asset coverage to the switch page', () => {
    const { container } = renderModal();

    expect(container.textContent).not.toContain('defi_collateral');
    expect(container.textContent).not.toContain('defi_borrowable');
    expect(container.querySelector('[data-tokens]')).toBeNull();
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
});
