import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { openInviteWithdrawAddressEditor } from './openInviteWithdrawAddressEditor';

jest.mock('@onekeyhq/components', () => ({
  Toast: { success: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      page: {
        editReceivingAddress: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWebDappMode: false },
}));

describe('openInviteWithdrawAddressEditor', () => {
  it('opens EditAddress with OneKey ID withdrawAddresses[0] and no Home Account', () => {
    const navigateToEditAddress = jest.fn();
    const summaryInfo = {
      enabledNetworks: ['evm--1'],
      withdrawAddresses: [
        {
          _id: 'id-1',
          networkId: 'evm--1',
          userId: 'onekey-id',
          __v: 0,
          address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          createdAt: '',
          updatedAt: '',
        },
        {
          _id: 'id-2',
          networkId: 'evm--1',
          userId: 'onekey-id',
          __v: 0,
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          createdAt: '',
          updatedAt: '',
        },
      ],
    } as IInviteSummary;

    openInviteWithdrawAddressEditor({
      summaryInfo,
      navigateToEditAddress,
      fetchSummaryInfo: jest.fn(),
      formatMessage: ({ id }) => id,
    });

    expect(navigateToEditAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        enabledNetworks: ['evm--1'],
        enableAllowListValidation: false,
      }),
    );
  });

  it('omits address when the OneKey ID has no withdraw address', () => {
    const navigateToEditAddress = jest.fn();

    openInviteWithdrawAddressEditor({
      summaryInfo: {
        enabledNetworks: ['evm--1'],
        withdrawAddresses: [],
      } as unknown as IInviteSummary,
      navigateToEditAddress,
      fetchSummaryInfo: jest.fn(),
      formatMessage: ({ id }) => id,
    });

    expect(navigateToEditAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '',
        address: undefined,
        enabledNetworks: ['evm--1'],
      }),
    );
  });
});
