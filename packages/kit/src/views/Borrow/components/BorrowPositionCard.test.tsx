/** @jest-environment jsdom */
/* eslint-disable import/first */

// apps/cli/src/__mocks__/react-native.js is a node-module manual mock, so jest
// auto-applies that CLI shim repo-wide and it carries no StyleSheet.
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 0.33 },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  type IMockProps = {
    children?: React.ReactNode;
    testID?: string;
    onPress?: (event: { stopPropagation: () => void }) => void;
    role?: string;
    disabled?: boolean;
    variant?: string;
    badgeType?: string;
    'aria-expanded'?: boolean;
  };

  // Forward only what the assertions read; onPress becomes a real DOM click so
  // the suite exercises browser bubbling instead of simulating it.
  const asDom = (tag: string) => {
    function MockStack({
      children,
      testID,
      onPress,
      role,
      disabled,
      variant,
      badgeType,
      ...rest
    }: IMockProps) {
      return React.createElement(
        tag,
        {
          'data-testid': testID,
          'data-variant': variant,
          'data-badge-type': badgeType,
          'aria-expanded': rest['aria-expanded'],
          role,
          disabled,
          type: tag === 'button' ? 'button' : undefined,
          onClick: onPress,
        },
        children,
      );
    }
    MockStack.displayName = `MockStack(${tag})`;
    return MockStack;
  };

  return {
    __esModule: true,
    Badge: asDom('div'),
    Button: asDom('button'),
    Image: asDom('div'),
    SizableText: asDom('span'),
    Stack: asDom('div'),
    XStack: asDom('div'),
    YStack: asDom('div'),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  __esModule: true,
  Token: ({ size }: { size?: string }) => <div data-token-size={size} />,
}));

jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  __esModule: true,
  EarnText: ({ text, size }: { text?: { text: string }; size?: string }) =>
    text ? <span data-size={size}>{text.text}</span> : null,
}));

jest.mock('./BorrowTableList/ApyTextV2', () => {
  const apyPress = jest.fn();
  (globalThis as Record<string, unknown>).__positionCardApyMock = apyPress;
  return {
    __esModule: true,
    ApyTextV2: ({ apyDetail }: { apyDetail: { apy: string } }) => (
      <button type="button" data-testid="apy-detail-trigger" onClick={apyPress}>
        {apyDetail.apy}
      </button>
    ),
  };
});

import { fireEvent, render } from '@testing-library/react';

import type { IBorrowToken } from '@onekeyhq/shared/types/staking';

import { BorrowPositionCard } from './BorrowPositionCard';

import type { IBorrowPositionCardAction } from './BorrowPositionCard';

const apyPressMock = (globalThis as Record<string, unknown>)
  .__positionCardApyMock as jest.Mock;

const token = {
  networkId: 'evm--1',
  address: '0xToken',
  logoURI: 'https://example.com/usdc.png',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
} as IBorrowToken;

function buildActions(
  overrides: Partial<IBorrowPositionCardAction> = {},
): IBorrowPositionCardAction[] {
  return [
    {
      key: 'withdraw',
      label: 'Withdraw',
      variant: 'secondary',
      testID: 'withdraw-btn',
      onPress: jest.fn(),
    },
    {
      key: 'supply',
      label: 'Supply',
      variant: 'primary',
      testID: 'supply-btn',
      onPress: jest.fn(),
      ...overrides,
    },
  ];
}

function renderCard(
  props: Partial<React.ComponentProps<typeof BorrowPositionCard>> = {},
) {
  return render(
    <BorrowPositionCard
      testID="position-card"
      actionsTestID="position-card-actions"
      token={token}
      tokenAmount={{ text: '20' }}
      fiatValue={{ text: '$20' }}
      apyDetail={{ apy: '3.78%' }}
      statusLabel="Supplied"
      statusBadgeType="success"
      actions={buildActions()}
      {...props}
    />,
  );
}

describe('BorrowPositionCard expand behaviour', () => {
  beforeEach(() => {
    apyPressMock.mockClear();
  });

  it('keeps the actions out of the tree until the card is expanded', () => {
    const { queryByTestId } = renderCard({ isExpanded: false });

    expect(queryByTestId('position-card-actions')).toBeNull();
    expect(queryByTestId('withdraw-btn')).toBeNull();
    expect(queryByTestId('supply-btn')).toBeNull();
  });

  it('renders the secondary action ahead of the primary one when expanded', () => {
    const { getByTestId } = renderCard({ isExpanded: true });
    const actions = getByTestId('position-card-actions');

    expect(
      Array.from(actions.children).map((node) => [
        node.textContent,
        node.getAttribute('data-variant'),
      ]),
    ).toEqual([
      ['Withdraw', 'secondary'],
      ['Supply', 'primary'],
    ]);
  });

  it('forwards a disabled action to the button', () => {
    const { getByTestId } = renderCard({
      isExpanded: true,
      actions: buildActions({ disabled: true }),
    });

    expect((getByTestId('supply-btn') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((getByTestId('withdraw-btn') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('toggles through onToggleExpand when the card body is pressed', () => {
    const onToggleExpand = jest.fn();
    const { getByTestId } = renderCard({ onToggleExpand });

    fireEvent.click(getByTestId('position-card'));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('exposes the expanded state only while the card can expand', () => {
    const { getByTestId, rerender } = renderCard({
      onToggleExpand: jest.fn(),
      isExpanded: true,
    });

    expect(getByTestId('position-card').getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(getByTestId('position-card').getAttribute('role')).toBe('button');

    rerender(
      <BorrowPositionCard
        testID="position-card"
        token={token}
        statusLabel="Supplied"
        statusBadgeType="success"
        actions={buildActions()}
      />,
    );

    expect(
      getByTestId('position-card').getAttribute('aria-expanded'),
    ).toBeNull();
    expect(getByTestId('position-card').getAttribute('role')).toBeNull();
  });

  it('does not toggle the card when the collateral control is pressed', () => {
    const onToggleExpand = jest.fn();
    const onCollateralPress = jest.fn();
    const { getByTestId } = renderCard({
      onToggleExpand,
      collateral: (
        <button
          type="button"
          data-testid="collateral-switch"
          onClick={onCollateralPress}
        >
          switch
        </button>
      ),
    });

    fireEvent.click(getByTestId('collateral-switch'));

    expect(onCollateralPress).toHaveBeenCalledTimes(1);
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('does not toggle the card when the APY detail is pressed', () => {
    const onToggleExpand = jest.fn();
    const { getByTestId } = renderCard({ onToggleExpand });

    fireEvent.click(getByTestId('apy-detail-trigger'));

    expect(apyPressMock).toHaveBeenCalledTimes(1);
    expect(onToggleExpand).not.toHaveBeenCalled();
  });
});
