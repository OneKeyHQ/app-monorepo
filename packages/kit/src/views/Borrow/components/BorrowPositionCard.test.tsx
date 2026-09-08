/** @jest-environment jsdom */
/* eslint-disable import/first */

// apps/cli/src/__mocks__/react-native.js is a node-module manual mock, so jest
// auto-applies that CLI shim repo-wide and it carries no StyleSheet.
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 0.33 },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isRuntimeBrowser: true },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  type IMockProps = Record<string, unknown> & {
    children?: React.ReactNode;
  };

  // Forward the DOM-meaningful props the assertions read; onPress becomes a
  // real click so the suite exercises browser bubbling instead of simulating
  // it. Tamagui-only props are dropped so React does not warn about them.
  const asDom = (tag: string) => {
    function MockStack({
      children,
      testID,
      onPress,
      onKeyDown,
      role,
      tabIndex,
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
          'aria-label': rest['aria-label'],
          role,
          tabIndex,
          disabled,
          type: tag === 'button' ? 'button' : undefined,
          onKeyDown,
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

jest.mock('./BorrowTableList/ApyTextV2', () => ({
  __esModule: true,
  ApyTextV2: ({ apyDetail }: { apyDetail: { apy: string } }) => (
    <span data-testid="apy-detail">{apyDetail.apy}</span>
  ),
}));

import { fireEvent, render } from '@testing-library/react';

import type { IBorrowToken } from '@onekeyhq/shared/types/staking';

import { BorrowPositionCard } from './BorrowPositionCard';

import type { IBorrowPositionCardAction } from './BorrowPositionCard';

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

  it('puts the button semantics on the asset row, never on the card itself', () => {
    const { getByTestId, container } = renderCard({
      onToggleExpand: jest.fn(),
      isExpanded: true,
      collateral: (
        <span
          data-testid="collateral-switch"
          role="switch"
          aria-checked="true"
          aria-label="Use as Collateral"
        />
      ),
    });

    // The card holds the collateral switch, so it must not claim role=button:
    // ARIA forbids a focusable descendant inside one.
    expect(getByTestId('position-card').getAttribute('role')).toBeNull();

    const disclosure = container.querySelector('[role="button"]');
    expect(disclosure).not.toBeNull();
    expect(disclosure?.getAttribute('aria-expanded')).toBe('true');
    expect(disclosure?.getAttribute('tabindex')).toBe('0');
    expect(disclosure?.querySelector('[role="switch"]')).toBeNull();
  });

  it('drops the disclosure semantics when the card cannot expand', () => {
    const { container } = render(
      <BorrowPositionCard
        testID="position-card"
        token={token}
        statusLabel="Supplied"
        statusBadgeType="success"
        actions={buildActions()}
      />,
    );

    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it('expands from the keyboard so the actions stay reachable without a pointer', () => {
    const onToggleExpand = jest.fn();
    const { container } = renderCard({ onToggleExpand });
    const disclosure = container.querySelector('[role="button"]') as Element;

    fireEvent.keyDown(disclosure, { key: 'Enter' });
    fireEvent.keyDown(disclosure, { key: ' ' });
    fireEvent.keyDown(disclosure, { key: 'a' });

    expect(onToggleExpand).toHaveBeenCalledTimes(2);
  });

  it('leaves the amounts in the accessible name instead of labelling over them', () => {
    const { container } = renderCard({ onToggleExpand: jest.fn() });
    const disclosure = container.querySelector('[role="button"]') as Element;

    // `accessible` merges the row's children into one node, so a label here
    // would replace their text and the balance would stop being announced.
    expect(disclosure.getAttribute('aria-label')).toBeNull();
    expect(disclosure.textContent).toContain('$20');
    expect(disclosure.textContent).toContain('USDC');
  });
});
