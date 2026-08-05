/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapRewardStatus } from '@onekeyhq/shared/src/referralCode/type';

const badgeProps: Array<{ badgeType?: string }> = [];

jest.mock('@onekeyhq/components', () => {
  function Badge({
    badgeType,
    children,
  }: {
    badgeType?: string;
    children?: ReactNode;
  }) {
    badgeProps.push({ badgeType });
    return <div data-testid="badge">{children}</div>;
  }
  function BadgeText({ children }: { children?: ReactNode }) {
    return <span>{children}</span>;
  }
  function Stack() {
    return <span />;
  }
  Badge.Text = BadgeText;
  return {
    Badge,
    Stack,
  };
});

import {
  SwapRewardStatusBadge,
  getSwapRewardStatusLabel,
} from './SwapRewardStatusBadge';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

describe('SwapRewardStatusBadge', () => {
  beforeEach(() => {
    badgeProps.length = 0;
  });

  it('maps the known statuses to their translations', () => {
    expect(getSwapRewardStatusLabel({ intl, status: 'PENDING' })).toBe(
      ETranslations.referral_pending,
    );
    expect(getSwapRewardStatusLabel({ intl, status: 'AVAILABLE' })).toBe(
      ETranslations.referral_undistributed,
    );
    expect(getSwapRewardStatusLabel({ intl, status: 'ARCHIVE' })).toBe(
      ETranslations.referral_distributed,
    );
  });

  it('degrades an unknown server status to raw text instead of throwing', () => {
    const unknownStatus = 'EXPIRED' as ISwapRewardStatus;

    expect(getSwapRewardStatusLabel({ intl, status: unknownStatus })).toBe(
      'EXPIRED',
    );

    render(<SwapRewardStatusBadge intl={intl} status={unknownStatus} />);

    expect(badgeProps).toEqual([{ badgeType: 'default' }]);
  });
});
