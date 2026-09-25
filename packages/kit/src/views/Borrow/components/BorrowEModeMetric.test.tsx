/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { BorrowTestIDs } from '../testIDs';

import { BorrowEModeMetric } from './BorrowEModeMetric';

const pushToBorrowEModeSwitch = jest.fn();
const navigation = {};

const status: IBorrowEModeStatus = {
  eModeId: 1,
  originalLtv: '75',
  categories: [
    {
      eModeId: 1,
      label: 'Stablecoins',
      ltv: '93',
      disabled: false,
      assets: [],
    },
  ],
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyhq/components', () => ({
  Icon: () => <span data-testid="chevron" />,
  SizableText: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Skeleton: () => <span data-testid="skeleton" />,
  XStack: ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <div
      role="button"
      tabIndex={onPress ? 0 : -1}
      data-testid={testID}
      data-pressable={onPress ? 'true' : 'false'}
      onClick={onPress}
      onKeyDown={onPress}
    >
      {children}
    </div>
  ),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => navigation,
}));
jest.mock('../BorrowProvider', () => ({
  useBorrowContext: () => ({
    market: {
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: '0xMarket',
    },
    earnAccount: { data: { account: { id: 'account-1' } } },
  }),
}));
jest.mock('../borrowUtils', () => ({
  BorrowNavigation: {
    pushToBorrowEModeSwitch: (...args: unknown[]) => {
      pushToBorrowEModeSwitch(...args);
    },
  },
}));
jest.mock('../pages/BorrowEModeSwitch/emodeUtils', () => ({
  normalizeEModeLabel: (label: string) => label,
}));
jest.mock('./OverviewMetric', () => ({
  OverviewMetric: ({
    action,
    isLoading,
    onPress,
    text,
  }: {
    action?: React.ReactNode;
    isLoading?: boolean;
    onPress?: () => void;
    text: { text: string };
  }) => (
    <button
      type="button"
      data-testid="emode-metric"
      data-loading={isLoading ? 'true' : 'false'}
      data-pressable={onPress ? 'true' : 'false'}
      disabled={!onPress}
      onClick={onPress}
    >
      {text.text}
      {action}
    </button>
  ),
}));

describe('BorrowEModeMetric terminal error', () => {
  beforeEach(() => {
    pushToBorrowEModeSwitch.mockClear();
  });

  it('hides a stale E-Mode value and disables its metric action after error', () => {
    const { getByTestId, rerender } = render(
      <BorrowEModeMetric eModeStatus={status} />,
    );
    const metric = getByTestId('emode-metric');
    expect(metric.textContent).toContain('Stablecoins');
    expect(metric.getAttribute('data-pressable')).toBe('true');

    rerender(<BorrowEModeMetric eModeStatus={status} isLoading />);
    expect(metric.textContent).toContain('Stablecoins');
    expect(metric.getAttribute('data-loading')).toBe('false');

    rerender(<BorrowEModeMetric eModeStatus={status} isError />);
    expect(metric.textContent).toBe('-');
    expect(metric.getAttribute('data-pressable')).toBe('false');
    fireEvent.click(metric);
    expect(pushToBorrowEModeSwitch).not.toHaveBeenCalled();
  });

  it('disables the E-Mode bar when stale status survives a request error', () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <BorrowEModeMetric eModeStatus={status} variant="bar" />,
    );
    const bar = getByTestId(BorrowTestIDs.overviewEModeCell);
    expect(bar.textContent).toContain('Stablecoins');
    expect(bar.getAttribute('data-pressable')).toBe('true');

    rerender(<BorrowEModeMetric eModeStatus={status} isError variant="bar" />);
    expect(bar.textContent).toContain('-');
    expect(bar.textContent).not.toContain('Stablecoins');
    expect(bar.getAttribute('data-pressable')).toBe('false');
    expect(queryByTestId('chevron')).toBeNull();
    fireEvent.click(bar);
    expect(pushToBorrowEModeSwitch).not.toHaveBeenCalled();
  });
});
