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

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () =>
    (globalThis as Record<string, unknown>).__reducedMotion === true,
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
      rotate,
      transition,
      size,
      color,
      ...rest
    }: IMockProps) {
      // accessibilityActions / onAccessibilityAction are native-only, so they
      // have no DOM surface to assert against. Park every rendered prop set
      // where a test can reach it.
      (
        ((globalThis as Record<string, unknown>).__positionCardStackProps ??=
          []) as IMockProps[]
      ).push({ ...rest, role, tabIndex, testID });
      return React.createElement(
        tag,
        {
          'data-testid': testID,
          'data-variant': variant,
          'data-badge-type': badgeType,
          'data-rotate': rotate,
          'data-size': size,
          'data-color': color,
          'data-transition': transition ?? 'none',
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

  function MockIcon({ name }: { name?: string }) {
    return <span data-icon={name} />;
  }
  MockIcon.displayName = 'MockIcon';

  return {
    __esModule: true,
    // jest.config.js maps the bare substring '@onekeyhq/components', so the
    // deep animationConstants path resolves to this same module and cannot be
    // mocked separately.
    ANIMATE_ONLY_TRANSFORM: ['transform'],
    Badge: asDom('div'),
    Button: asDom('button'),
    Icon: MockIcon,
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
  EarnText: ({
    text,
    size,
    color,
  }: {
    text?: { text: string };
    size?: string;
    color?: string;
  }) =>
    text ? (
      <span data-size={size} data-color={color}>
        {text.text}
      </span>
    ) : null,
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

const stackProps = () =>
  ((globalThis as Record<string, unknown>).__positionCardStackProps ??
    []) as Record<string, unknown>[];

const disclosureProps = () =>
  stackProps().find((p) => p.accessibilityRole === 'button');

describe('BorrowPositionCard amount hierarchy', () => {
  // The amount is what the user holds; the fiat value is a conversion of it.
  // The desktop table's AmountField already stacks them that way, and this card
  // had them inverted — fiat first, in $text, over a subdued amount.
  it('leads with the amount and trails the fiat value', () => {
    const { container } = renderCard({
      tokenAmount: { text: '20' },
      fiatValue: { text: '$20' },
    });
    const lines = Array.from(container.querySelectorAll('[data-size]')).map(
      (n) => [n.textContent, n.getAttribute('data-color')],
    );
    const amount = lines.findIndex(([t]) => t === '20');
    const fiat = lines.findIndex(([t]) => t === '$20');

    expect(amount).toBeGreaterThanOrEqual(0);
    expect(fiat).toBeGreaterThan(amount);
    expect(lines[amount][1]).toBe('$text');
    expect(lines[fiat][1]).toBe('$textSubdued');
  });

  // $bodyLgMedium is the tier Earn's asset rows use for the token name and the
  // APY. A position and the offering that creates it should not read at
  // different weights.
  it("sizes the amount and the token symbol to Earn's asset rows", () => {
    const { container, getAllByText } = renderCard({
      tokenAmount: { text: '20' },
      fiatValue: { text: '$20' },
    });
    const amount = Array.from(container.querySelectorAll('[data-size]')).find(
      (n) => n.textContent === '20',
    );
    // The symbol renders twice: once as the asset's name, once as the unit
    // trailing the amount. Both sit on the primary tier.
    const symbols = getAllByText('USDC');

    expect(amount?.getAttribute('data-size')).toBe('$bodyLgMedium');
    expect(symbols).toHaveLength(2);
    symbols.forEach((node) =>
      expect(node.getAttribute('data-size')).toBe('$bodyLgMedium'),
    );
  });

  it('lets the server override the amount treatment', () => {
    const { container } = renderCard({
      tokenAmount: { text: '20', size: '$bodySm', color: '$textCaution' },
    });
    const amount = Array.from(container.querySelectorAll('[data-size]')).find(
      (n) => n.textContent === '20',
    );

    expect(amount?.getAttribute('data-size')).toBe('$bodySm');
    expect(amount?.getAttribute('data-color')).toBe('$textCaution');
  });
});

describe('BorrowPositionCard screen-reader activation', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__positionCardStackProps = [];
  });

  // onAccessibilityTap routes through iOS accessibilityActivate only, and this
  // row deliberately has no onPress for a TalkBack ACTION_CLICK to land on, so
  // the generic action is the only path that works on both platforms.
  it('exposes an activate action rather than an iOS-only tap handler', () => {
    const onToggleExpand = jest.fn();
    renderCard({ onToggleExpand });
    const props = disclosureProps();

    expect(props?.onAccessibilityTap).toBeUndefined();
    expect(props?.accessibilityActions).toEqual([{ name: 'activate' }]);

    (
      props?.onAccessibilityAction as (e: {
        nativeEvent: { actionName: string };
      }) => void
    )({ nativeEvent: { actionName: 'activate' } });

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('ignores an accessibility action it does not own', () => {
    const onToggleExpand = jest.fn();
    renderCard({ onToggleExpand });

    (
      disclosureProps()?.onAccessibilityAction as (e: {
        nativeEvent: { actionName: string };
      }) => void
    )({ nativeEvent: { actionName: 'increment' } });

    expect(onToggleExpand).not.toHaveBeenCalled();
  });
});

describe('BorrowPositionCard collateral slot', () => {
  // Narrow on purpose: the real swallow lives in CollateralSwitchCell and is
  // covered there. What is left for the card is that it takes the press on the
  // bubble phase, so a child that stops propagation is actually obeyed — a
  // capture-phase handler here would silently override every such child. Web
  // only; on native the swallow runs through the touch responder instead.
  it('does not expand when the collateral control swallows the press', () => {
    const onToggleExpand = jest.fn();
    const { getByTestId } = renderCard({
      onToggleExpand,
      collateral: (
        <button
          type="button"
          aria-label="Use as Collateral"
          data-testid="collateral-switch"
          onClick={(event) => event.stopPropagation()}
        />
      ),
    });

    fireEvent.click(getByTestId('collateral-switch'));

    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  // The mirror case: without the stop the press does reach the card, which is
  // why CollateralSwitchCell's wrapper cannot be dropped.
  it('expands when the collateral control lets the press through', () => {
    const onToggleExpand = jest.fn();
    const { getByTestId } = renderCard({
      onToggleExpand,
      collateral: <span data-testid="collateral-inert">x</span>,
    });

    fireEvent.click(getByTestId('collateral-inert'));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});

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

  it('signals the collapsed card with a chevron pointing at the hidden content', () => {
    const { container } = renderCard({
      onToggleExpand: jest.fn(),
      isExpanded: false,
    });
    const chevron = container.querySelector(
      '[data-icon="ChevronDownSmallOutline"]',
    );

    expect(chevron).not.toBeNull();
    expect(chevron?.parentElement?.getAttribute('data-rotate')).toBe('-90deg');
  });

  it('turns the chevron down once the card is expanded', () => {
    const { container } = renderCard({
      onToggleExpand: jest.fn(),
      isExpanded: true,
    });

    expect(
      container
        .querySelector('[data-icon="ChevronDownSmallOutline"]')
        ?.parentElement?.getAttribute('data-rotate'),
    ).toBe('0deg');
  });

  // A chevron on a card that cannot expand is a false affordance.
  it('omits the chevron when the card cannot expand', () => {
    const { container } = render(
      <BorrowPositionCard
        testID="position-card"
        token={token}
        statusLabel="Supplied"
        statusBadgeType="success"
        actions={buildActions()}
      />,
    );

    expect(
      container.querySelector('[data-icon="ChevronDownSmallOutline"]'),
    ).toBeNull();
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

describe('BorrowPositionCard reduced motion', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__reducedMotion;
  });

  it('animates the chevron by default', () => {
    const { container } = renderCard({ onToggleExpand: jest.fn() });

    expect(
      container
        .querySelector('[data-icon="ChevronDownSmallOutline"]')
        ?.parentElement?.getAttribute('data-transition'),
    ).toBe('quick');
  });

  // The rotation still happens; only the tween is dropped, so the collapsed
  // and expanded states stay distinguishable.
  it('drops the tween when the system asks for reduced motion', () => {
    (globalThis as Record<string, unknown>).__reducedMotion = true;
    const { container } = renderCard({
      onToggleExpand: jest.fn(),
      isExpanded: false,
    });
    const chevron = container.querySelector(
      '[data-icon="ChevronDownSmallOutline"]',
    );

    expect(chevron?.parentElement?.getAttribute('data-transition')).toBe(
      'none',
    );
    expect(chevron?.parentElement?.getAttribute('data-rotate')).toBe('-90deg');
  });
});
