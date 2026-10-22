/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

type IStatusResult =
  | { walletId: string | undefined; status: string }
  | undefined;

let mockStatusResult: IStatusResult;
const mockBindWalletInviteCode = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockStatusResult, run: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { wallet: { id: 'hd-1' } } }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  () => ({
    useGetReferralCodeWalletInfo: () => jest.fn(),
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
    description?: string;
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

import { BenefitsTabPlaceholder } from './BenefitsTabPlaceholder';

function getText() {
  return screen.getByTestId('empty').textContent;
}

describe('BenefitsTabPlaceholder', () => {
  beforeEach(() => {
    mockStatusResult = undefined;
  });

  it('asks for a code when the wallet can still take one', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'bind' };
    render(<BenefitsTabPlaceholder />);
    expect(getText()).toContain('referral_perks_empty__desc');
    expect(
      screen.getByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeTruthy();
  });

  it('keeps the code button when the bind check failed', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'unknown' };
    render(<BenefitsTabPlaceholder />);
    expect(
      screen.getByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeTruthy();
  });

  it('drops the code prompt for a wallet that is already bound', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'bound' };
    render(<BenefitsTabPlaceholder />);
    expect(getText()).toContain(ETranslations.referral_no_reward);
    expect(getText()).not.toContain('referral_perks_empty__desc');
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('explains why a wallet past the bind window cannot take a code', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'notApplicable' };
    render(<BenefitsTabPlaceholder />);
    expect(getText()).toContain(ETranslations.referral_not_applicable_desc);
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('says a wallet that cannot take codes is not applicable', () => {
    mockStatusResult = { walletId: 'hd-1', status: 'unsupported' };
    render(<BenefitsTabPlaceholder />);
    expect(getText()).toBe(ETranslations.referral_not_applicable);
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });

  it('offers nothing while the status is loading or from another wallet', () => {
    mockStatusResult = { walletId: 'hd-2', status: 'bind' };
    render(<BenefitsTabPlaceholder />);
    expect(getText()).toBe('referral_perks_empty__title');
    expect(
      screen.queryByTestId(ReferFriendsTestIDs.benefitsBindBtn),
    ).toBeNull();
  });
});
