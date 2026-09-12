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
      onKeyDown,
      role,
      tabIndex,
      name,
      ...rest
    }: IMockProps) {
      // Forward every aria-* the component produced rather than a whitelist.
      // A whitelist makes these tests assert what the mock remembers to pass
      // on, so a newly added attribute reads as absent and a dropped one still
      // passes.
      const aria = Object.fromEntries(
        Object.entries(rest).filter(([key]) => key.startsWith('aria-')),
      );
      return React.createElement(
        tag,
        {
          'data-testid': testID,
          'data-icon': name,
          'data-opacity': rest.opacity,
          ...aria,
          role,
          tabIndex,
          onKeyDown,
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

// jest.mock is hoisted, so the factory runs before this const initializes; the
// `mock` prefix clears the out-of-scope guard and the wrapper defers the read
// until the hook is actually called.
const mockUseBorrowEModeStatus = jest.fn();
jest.mock('@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus', () => ({
  __esModule: true,
  useBorrowEModeStatus: (params: unknown) =>
    mockUseBorrowEModeStatus(params) as unknown,
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

const scope = {
  networkId: 'evm--8453',
  provider: 'aave_v3',
  marketAddress: '0xmarket',
  accountId: 'acc-1',
};

function renderModal({
  selectedEModeId = 1,
  onSelect = jest.fn(),
  status = eModeStatus,
}: {
  selectedEModeId?: number | null;
  onSelect?: jest.Mock;
  status?: IBorrowEModeStatus | null;
} = {}) {
  (globalThis as Record<string, any>).__eModeRouteParams = {
    ...scope,
    selectedEModeId,
    onSelect,
  };
  (globalThis as Record<string, any>).__eModePop = pop;
  mockUseBorrowEModeStatus.mockReturnValue({ eModeStatus: status });
  return { onSelect, ...render(<BorrowEModeCategorySelectModal />) };
}

const rowOf = (container: HTMLElement, eModeId: number) =>
  container.querySelector(
    `[data-testid="borrow-e-mode-category-row-${eModeId}"]`,
  ) as HTMLElement;

const markOf = (container: HTMLElement, eModeId: number) =>
  rowOf(container, eModeId).querySelector('[data-icon="CheckLargeOutline"]');

describe('BorrowEModeCategorySelectModal', () => {
  beforeEach(() => {
    pop.mockClear();
    mockUseBorrowEModeStatus.mockClear();
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
    expect(container.textContent).not.toContain('USDC');
    expect(container.textContent).not.toContain('WETH');
  });

  it('reports the pick and closes itself', () => {
    const { container, onSelect } = renderModal();

    fireEvent.click(rowOf(container, 0));

    expect(onSelect).toHaveBeenCalledWith(0, 1);
    expect(pop).toHaveBeenCalledTimes(1);
  });

  // The pusher stops revalidating while this screen is on top, so its copy of
  // the status can be the older one. Report what was actually on screen, or the
  // caller decides "is this the category you are already in" for a screen the
  // user never saw.
  it('reports the current category it displayed, not the one it was pushed with', () => {
    const { container, onSelect } = renderModal({
      status: { ...eModeStatus, eModeId: 2 } as IBorrowEModeStatus,
    });

    fireEvent.click(rowOf(container, 0));

    expect(onSelect).toHaveBeenCalledWith(0, 2);
  });

  it('does not let a disabled category be picked', () => {
    const { container, onSelect } = renderModal();

    fireEvent.click(rowOf(container, 2));

    expect(onSelect).not.toHaveBeenCalled();
    expect(pop).not.toHaveBeenCalled();
  });

  // This screen replaced a Select, which was a real listbox. An XStack with an
  // onPress carries no keyboard path of its own, so the rows have to state it.
  it('picks a category from the keyboard', () => {
    const { container, onSelect } = renderModal();
    const row = rowOf(container, 0);

    expect(row.getAttribute('role')).toBe('radio');
    expect(row.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(0, 1);

    fireEvent.keyDown(row, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // react-native-web 0.21 dropped accessibilityState from its forwarded props,
  // so a row that only carries accessibilityState={{checked}} announces nothing
  // on the web. These assert the DOM, not the prop object.
  it('tells a web screen reader which category is picked', () => {
    const { container } = renderModal();

    // The fixture opens with category 1 picked.
    expect(rowOf(container, 1).getAttribute('role')).toBe('radio');
    expect(rowOf(container, 1).getAttribute('aria-checked')).toBe('true');
    expect(rowOf(container, 0).getAttribute('aria-checked')).toBe('false');
    // A disabled row still reports its state rather than going silent.
    expect(rowOf(container, 2).getAttribute('aria-checked')).toBe('false');
  });

  it('groups the rows so the count and the pick are announced together', () => {
    const { container } = renderModal();
    const group = container.querySelector('[role="radiogroup"]');

    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).not.toBeNull();
  });

  it('ignores keys that are not Enter or Space', () => {
    const { container, onSelect } = renderModal();

    fireEvent.keyDown(rowOf(container, 0), { key: 'a' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps a disabled category off the tab order and marks it for a11y', () => {
    const { container, onSelect } = renderModal();
    const row = rowOf(container, 2);

    expect(row.getAttribute('tabindex')).toBeNull();
    expect(row.getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(row, { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  // Route params are captured once at push time. Reading the status through
  // the hook is what keeps a pick correct after a pending setEMode confirms
  // while this screen is open.
  it('reads the status from the hook, scoped to the pushed params', () => {
    renderModal();

    expect(mockUseBorrowEModeStatus).toHaveBeenCalledWith({
      ...scope,
      enabled: true,
    });
  });

  it('follows the hook when the current category changes underneath it', () => {
    const { container } = renderModal({
      status: { ...eModeStatus, eModeId: 2 } as IBorrowEModeStatus,
      selectedEModeId: null,
    });

    expect(rowOf(container, 2).textContent).toContain('global_current');
    expect(rowOf(container, 1).textContent).not.toContain('global_current');
  });

  // With no explicit pick the checkmark tracks the current category, so it has
  // to move with it; leaving it on the old row would put the tick and the
  // Current badge on different rows.
  it('moves the checkmark with the current category when nothing was picked', () => {
    const { container } = renderModal({
      status: { ...eModeStatus, eModeId: 2 } as IBorrowEModeStatus,
      selectedEModeId: null,
    });

    expect(markOf(container, 2)).not.toBeNull();
    expect(markOf(container, 1)).toBeNull();
  });

  // An explicit pick is the user's, and only this screen changes it, so it
  // stays put even when the current category moves.
  it('keeps the checkmark on an explicit pick', () => {
    const { container } = renderModal({
      status: { ...eModeStatus, eModeId: 2 } as IBorrowEModeStatus,
      selectedEModeId: 1,
    });

    expect(markOf(container, 1)).not.toBeNull();
    expect(markOf(container, 2)).toBeNull();
    expect(rowOf(container, 2).textContent).toContain('global_current');
  });

  it('renders nothing to pick while the status is still resolving', () => {
    const { container } = renderModal({ status: null });

    expect(
      container.querySelectorAll(
        '[data-testid^="borrow-e-mode-category-row-"]',
      ),
    ).toHaveLength(0);
  });
});
