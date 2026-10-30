/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

type IStatusResult =
  | { walletId: string | undefined; status: string }
  | undefined;

let mockStatusResult: IStatusResult;
let mockWalletId: string | undefined = 'hd-1';
const mockBindWalletInviteCode = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Skeleton: { BodyMd: () => <i data-testid="description-skeleton" /> },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockStatusResult, run: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      wallet: mockWalletId === undefined ? undefined : { id: mockWalletId },
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  () => ({
    useWalletBoundReferralCode: () => ({
      bindWalletInviteCode: mockBindWalletInviteCode,
      getReferralCodeBindDisplayStatus: jest.fn(),
    }),
  }),
);

jest.mock('../../../components/ReferralCardEmpty', () => ({
  ReferralCardEmpty: ({
    title,
    description,
    buttonProps,
  }: {
    title: string;
    description?: ReactNode;
    buttonProps?: { children: ReactNode; testID?: string };
  }) => (
    <div data-testid="empty">
      <span>{title}</span>
      {description ? <span>{description}</span> : null}
      {buttonProps ? (
        <button type="button" data-testid={buttonProps.testID}>
          {buttonProps.children}
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('./useInviteCardStyle', () => ({
  useInviteHomeCardStyle: () => ({}),
}));

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';

import {
  BenefitsTabPlaceholder,
  useBenefitsBindStatus,
} from './BenefitsTabPlaceholder';

function Subject() {
  return <BenefitsTabPlaceholder bindStatus={useBenefitsBindStatus()} />;
}

function getText() {
  return screen.getByTestId('empty').textContent;
}

describe('BenefitsTabPlaceholder', () => {
  beforeEach(() => {
    mockStatusResult = undefined;
    mockWalletId = 'hd-1';
  });

  it('asks for a code when the wallet can still take one', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'bind' };
    render(<Subject />);
    expect(getText()).toContain('referral_perks_empty__desc');
    expect(
      screen.getByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeTruthy();
  });

  it('keeps the code button when the bind check failed', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'unknown' };
    render(<Subject />);
    expect(
      screen.getByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeTruthy();
  });

  it('drops the code prompt for a wallet that is already bound', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'bound' };
    render(<Subject />);
    expect(getText()).toContain(ETranslations.referral_no_reward);
    expect(getText()).not.toContain('referral_perks_empty__desc');
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('explains why a wallet past the bind window cannot take a code', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'notApplicable' };
    render(<Subject />);
    expect(getText()).toContain(ETranslations.referral_not_applicable_desc);
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('says a wallet that cannot take codes is not applicable', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'unsupported' };
    render(<Subject />);
    expect(getText()).toBe(ETranslations.referral_not_applicable);
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('offers nothing when the wallet and its status are both missing', () => {
    mockWalletId = undefined;
    mockStatusResult = undefined;
    render(<Subject />);
    expect(getText()).toBe('referral_perks_empty__title');
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('offers nothing while the status is loading or from another wallet', () => {
    mockStatusResult = { walletId: 'hd-2', status: 'bind' };
    render(<Subject />);
    expect(getText()).toBe('referral_perks_empty__title');
    // The description line is held so the card keeps its height.
    expect(screen.getByTestId('description-skeleton')).toBeTruthy();
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });
});
