/** @jest-environment jsdom */

import { createContext } from 'react';
import type { ReactNode } from 'react';

import ReferAFriend from '.';

import { fireEvent, render, screen } from '@testing-library/react';

import { ReferFriendsTestIDs } from '../../testIDs';

type ITestSources = Partial<Record<1 | 2, { step: 1 | 2 }>>;

const mockSources = createContext<ITestSources>({});
const introSource = { step: 1 } as const;
const howToSource = { step: 2 } as const;
let mockThemeVariant = 'light';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ name: 'ReferAFriend' }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => mockThemeVariant,
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    'aria-hidden': hidden,
  }: {
    children?: ReactNode;
    'aria-hidden'?: boolean;
  }) => <div hidden={hidden}>{children}</div>;
  return {
    AnimatePresence: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
    Page: Object.assign(
      ({
        children,
        directFooter,
      }: {
        children: ReactNode;
        directFooter?: { children: ReactNode };
      }) => (
        <div>
          {children}
          {directFooter?.children}
        </div>
      ),
      { Header: () => null, Body: Stack, Container: Stack, Footer: Stack },
    ),
    Button: ({
      children,
      testID,
      onPress,
    }: {
      children: ReactNode;
      testID: string;
      onPress: () => void;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    LottieView: ({ source }: { source: { step: 1 | 2 } }) => (
      <div role="img" aria-label={`Step ${source.step} illustration`} />
    ),
    useMedia: () => ({ md: true }),
    usePageWidth: () => 390,
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('@onekeyhq/kit/src/components/LazyPageContainer', () => ({
  LazyPageContainer: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/hooks/useReferFriends', () => ({
  useReferFriends: () => ({ toInviteRewardPage: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useReferLottieSource',
  () => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    return {
      useReferLottieSource: (step: 1 | 2) => useContext(mockSources)[step],
    };
  },
);
jest.mock('../InviteReward/components/ReferralJobTabs', () => ({}));
jest.mock('../InviteReward/components/ReferralTabCrossLink', () => ({}));
jest.mock('../InviteReward/referralPageTab', () => ({
  EReferralPageTab: { invite: 'invite' },
  IS_BENEFITS_TAB_ENABLED: false,
}));
jest.mock('../InviteReward/referralTabCopy', () => ({
  useReferralTabCopy: () => ({}),
}));
jest.mock('../InviteReward/useReferralPageTab', () => ({
  useReferralPageTab: () => 'invite',
}));
jest.mock('../InviteReward/useReferralTabSwitch', () => ({
  useReferralTabSwitch: () => ({}),
}));
jest.mock('../MyRewards', () => ({}));
jest.mock('./components/ReferAFriendIntroPhase', () => ({
  ReferAFriendIntroPhase: () => <h2>Hardware referral</h2>,
}));
jest.mock('./components/ReferAFriendHowToPhase', () => ({
  ReferAFriendHowToPhase: () => <h2>On-chain referral</h2>,
}));
jest.mock('./hooks/useReferAFriendData', () => ({
  useReferAFriendData: () => ({ postConfig: {} }),
}));

function renderWithSources(sources: ITestSources) {
  return (
    <mockSources.Provider value={sources}>
      <ReferAFriend />
    </mockSources.Provider>
  );
}

function expectIntroVisible() {
  expect(screen.getByRole('img', { name: 'Step 1 illustration' })).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Hardware referral' }),
  ).toBeTruthy();
  expect(screen.getByTestId(ReferFriendsTestIDs.nextBtn)).toBeTruthy();
  expect(screen.queryByTestId(ReferFriendsTestIDs.joinBtn)).toBeNull();
}

function expectHowToVisible() {
  expect(screen.getByRole('img', { name: 'Step 2 illustration' })).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'On-chain referral' }),
  ).toBeTruthy();
  expect(screen.getByTestId(ReferFriendsTestIDs.previousBtn)).toBeTruthy();
  expect(screen.queryByTestId(ReferFriendsTestIDs.nextBtn)).toBeNull();
}

describe('iOS referral phases', () => {
  beforeEach(() => {
    mockThemeVariant = 'light';
  });

  it('keeps the intro visible until the next illustration is ready', () => {
    const { rerender } = render(renderWithSources({ 1: introSource }));

    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.nextBtn));
    expectIntroVisible();

    rerender(renderWithSources({ 1: introSource, 2: howToSource }));
    expectHowToVisible();
  });

  it('waits for the intro illustration again after changing theme', () => {
    const { rerender } = render(
      renderWithSources({ 1: introSource, 2: howToSource }),
    );
    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.nextBtn));
    expectHowToVisible();

    mockThemeVariant = 'dark';
    rerender(renderWithSources({ 2: howToSource }));
    fireEvent.click(screen.getByTestId(ReferFriendsTestIDs.previousBtn));
    expectHowToVisible();

    rerender(renderWithSources({ 1: introSource, 2: howToSource }));
    expectIntroVisible();
  });
});
