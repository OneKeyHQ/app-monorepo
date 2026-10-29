/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { LevelPolicyNotice } from '@onekeyhq/kit/src/views/ReferFriends/components/LevelPolicyNotice';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { getLevelOverview } from '../getLevelOverview';

import { LevelStatusCard } from './LevelStatusCard';

const mockShowDialog = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Component = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Dialog: {
      show: (options: unknown) => {
        mockShowDialog(options);
      },
    },
    Divider: Component,
    Icon: Component,
    Image: Component,
    IconButton: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
      React.createElement('button', {
        type: 'button',
        'aria-label': accessibilityLabel,
      }),
    SizableText: Component,
    Stack: Component,
    XStack: Component,
    YStack: Component,
    Popover: ({ renderTrigger }: { renderTrigger: ReactNode }) => renderTrigger,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values?.date ? `${id}: ${values.date}` : id,
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: () => '2026/10/31 00:00',
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle',
  () => ({
    INVITE_CARD_BORDER_COLOR: '',
    useInviteListCardStyle: () => ({}),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/CardTextAction',
  () => ({
    CardTextAction: ({
      label,
      onPress,
    }: {
      label: string;
      onPress: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {label}
      </button>
    ),
  }),
);

jest.mock('./UpgradeTargetsCard', () => ({
  UpgradeTargetsSection: () => <div data-testid="upgrade-targets" />,
}));

const LEVELS: IInviteLevelDetail['levels'] = [0, 1, 2].map((level) => ({
  level,
  label: `Level ${level}`,
  labelKey: '',
  icon: '',
  emoji: '',
  isCurrent: level === 1,
  commissionRates: {},
  upgradeConditions: [
    {
      subject: 'HardwareSales',
      current: '0',
      currentFiatValue: '0',
      threshold: '100',
      thresholdFiatValue: '100',
      progress: '0',
    },
  ],
}));

function renderCard(policy: 'normal' | 'floor' | 'fixed', currentLevel = 1) {
  const overview = getLevelOverview(
    {
      currentLevel,
      levels: LEVELS,
      levelProgress: {},
      levelPolicy: policy,
      floorUntil: '2026-10-30T16:00:00.000Z',
    },
    Date.parse('2026-10-29T00:00:00.000Z'),
  );
  const { currentLevel: level, ...props } = overview;
  if (!level) throw new OneKeyLocalError('Missing test level');
  return render(<LevelStatusCard level={level} {...props} />);
}

beforeEach(() => mockShowDialog.mockClear());

it.each([
  {
    policy: 'floor' as const,
    title: ETranslations.referral_level_protected__title,
    description: ETranslations.referral_level_protected__desc,
  },
  {
    policy: 'fixed' as const,
    title: ETranslations.referral_level_fixed__title,
    description: ETranslations.referral_level_fixed__desc,
  },
])(
  'shows $policy help directly in the home popover and keeps the info entry on the level page',
  ({ policy, title, description }) => {
    const { rerender } = render(
      <LevelPolicyNotice policy={policy} inlineDescription />,
    );
    expect(screen.getByText(description)).toBeTruthy();
    expect(screen.queryByRole('button', { name: title })).toBeNull();

    rerender(<LevelPolicyNotice policy={policy} />);
    expect(screen.queryByText(description)).toBeNull();
    expect(screen.getByRole('button', { name: title })).toBeTruthy();
  },
);

it('shows protection and its end time while retaining upgrade progress', () => {
  renderCard('floor');
  expect(
    screen.getByText(ETranslations.referral_level_protected__title),
  ).toBeTruthy();
  expect(
    screen.getByText(
      `${ETranslations.referral_level_protection_until__desc}: 2026/10/31 00:00`,
    ),
  ).toBeTruthy();
  expect(screen.getByTestId('upgrade-targets')).toBeTruthy();
  expect(
    screen.queryByText(ETranslations.referral_level_not_kept__msg),
  ).toBeNull();
});

it('does not present a fixed lower level as the highest level or offer upgrades', () => {
  renderCard('fixed');
  expect(
    screen.getByText(ETranslations.referral_level_fixed__title),
  ).toBeTruthy();
  expect(screen.queryByTestId('upgrade-targets')).toBeNull();
  expect(screen.queryByText(ETranslations.referral_top_level__msg)).toBeNull();
  expect(
    screen.queryByText(ETranslations.referral_level_not_kept__msg),
  ).toBeNull();
});

it('keeps the normal retention and upgrade display', () => {
  renderCard('normal');
  expect(
    screen.getByText(ETranslations.referral_level_not_kept__msg),
  ).toBeTruthy();
  expect(screen.getByTestId('upgrade-targets')).toBeTruthy();
  expect(
    screen.queryByText(ETranslations.referral_level_protected__title),
  ).toBeNull();
  expect(
    screen.queryByText(ETranslations.referral_level_fixed__title),
  ).toBeNull();
});

it.each(['floor', 'fixed'] as const)(
  'restores normal hints after %s is cancelled',
  (policy) => {
    const { rerender } = renderCard(policy);
    const { currentLevel: _currentLevel, ...normal } = getLevelOverview({
      currentLevel: 1,
      levels: LEVELS,
      levelProgress: {},
      levelPolicy: 'normal',
      floorUntil: '2026-10-30T16:00:00.000Z',
    });
    rerender(<LevelStatusCard level={LEVELS[1]} {...normal} />);

    expect(screen.getByText('Level 1')).toBeTruthy();
    expect(
      screen.getByText(ETranslations.referral_level_not_kept__msg),
    ).toBeTruthy();
    expect(screen.getByTestId('upgrade-targets')).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.referral_level_protected__title),
    ).toBeNull();
    expect(
      screen.queryByText(ETranslations.referral_level_fixed__title),
    ).toBeNull();
    expect(
      screen.queryByText(
        `${ETranslations.referral_level_protection_until__desc}: 2026/10/31 00:00`,
      ),
    ).toBeNull();
  },
);

it.each(['floor', 'fixed'] as const)(
  'uses policy-specific rules for %s users',
  (policy) => {
    renderCard(policy);
    fireEvent.click(
      screen.getByText(ETranslations.referral_level_rules__action),
    );
    const { renderContent } = mockShowDialog.mock.calls[0][0] as {
      renderContent: ReactNode;
    };
    render(renderContent);
    expect(
      screen.queryByText(ETranslations.referral_referral_level_desc2),
    ).toBeNull();
    expect(
      screen.getByText(
        policy === 'floor'
          ? ETranslations.referral_level_protected__desc
          : ETranslations.referral_level_fixed__desc,
      ),
    ).toBeTruthy();
  },
);
