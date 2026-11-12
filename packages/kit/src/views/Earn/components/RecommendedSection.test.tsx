/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { RecommendedSection } from './RecommendedSection';

type IMockStackProps = {
  children?: ReactNode;
  testID?: string;
  flex?: number;
  flexWrap?: string;
  flexShrink?: number;
};

// The row is laid out by Yoga on native only; web keeps its wrapping title.
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('@onekeyhq/components', () => {
  const MockStack = ({
    children,
    testID,
    flex,
    flexWrap,
    flexShrink,
  }: IMockStackProps) => (
    <div
      data-testid={testID}
      data-flex={flex}
      data-flex-wrap={flexWrap}
      data-flex-shrink={flexShrink}
    >
      {children}
    </div>
  );
  const MockBadge = ({ children }: { children?: ReactNode }) => (
    <div data-testid="recommended-badge">{children}</div>
  );
  MockBadge.Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    Badge: MockBadge,
    Button: ({ children }: { children?: ReactNode }) => (
      <button type="button">{children}</button>
    ),
    HeaderScrollGestureWrapper: ({ children }: { children?: ReactNode }) =>
      children,
    IconButton: () => null,
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => null,
    Stack: MockStack,
    XStack: MockStack,
    YStack: MockStack,
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));

jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: jest.fn() },
  GestureDetector: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'div' },
  clamp: jest.fn(),
  useAnimatedStyle: jest.fn(() => ({})),
  useSharedValue: jest.fn((value: number) => ({ value })),
  withDecay: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { staking: { page: { selectAsset: jest.fn() } } },
}));

jest.mock('../../../components/ListItem', () => {
  const MockListItem = ({
    children,
    renderAvatar,
    testID,
  }: {
    children?: ReactNode;
    renderAvatar?: ReactNode;
    testID?: string;
  }) => (
    <div data-testid={testID}>
      {renderAvatar}
      {children}
    </div>
  );
  MockListItem.Text = ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => (
    <div>
      {primary}
      {secondary}
    </div>
  );
  return { ListItem: MockListItem };
});

jest.mock('../../../components/Token', () => ({
  Token: () => null,
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('./AprText', () => ({
  AprText: () => null,
}));

function buildToken(overrides: Partial<IRecommendAsset>): IRecommendAsset {
  return {
    name: 'USD Coin',
    symbol: 'USDC',
    logoURI: 'https://example.com/usdc.png',
    protocols: [{ networkId: 'evm--1', provider: 'morpho' }],
    aprWithoutFee: '4.46%',
    aprInfo: {},
    bgColor: '$bgSubdued',
    available: { text: 'Available 128.6', color: '$textSubdued' },
    isRecommended: true,
    isPinedRecommend: false,
    badges: [],
    ...overrides,
  } as IRecommendAsset;
}

describe('RecommendedSection mobile list row on native', () => {
  it('keeps the title row on one line and sized by its content', () => {
    render(
      <RecommendedSection
        withHeader={false}
        tokens={[
          buildToken({
            badges: [
              { badgeType: 'success', tag: 'Rewards' },
              { badgeType: 'info', tag: 'New' },
            ],
          }),
        ]}
      />,
    );

    const titleRow = screen.getByText('USDC').parentElement;
    const badgeRow = screen
      .getByText('Rewards')
      .closest('[data-testid="recommended-badge"]')?.parentElement;

    expect(titleRow).toBeTruthy();
    expect(badgeRow).toBeTruthy();
    expect(badgeRow?.parentElement).toBe(titleRow);

    // The row height must not depend on the row width. A wrapping title that
    // is also a `flex: 1` item of the auto-height text column keeps the
    // two-line flex basis Yoga computed during a single narrower layout pass,
    // so the title and the balance drift apart once the width is back
    // (OK-67080).
    expect(titleRow?.getAttribute('data-flex')).toBeNull();
    expect(titleRow?.getAttribute('data-flex-wrap')).toBeNull();
    expect(badgeRow?.getAttribute('data-flex-wrap')).toBe('nowrap');
    expect(badgeRow?.getAttribute('data-flex-shrink')).toBe('0');
  });
});
