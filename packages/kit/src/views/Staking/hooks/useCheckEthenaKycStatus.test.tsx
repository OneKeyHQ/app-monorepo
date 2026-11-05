/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useCheckEthenaKycStatus } from './useCheckEthenaKycStatus';

const mockGetAllAccounts = jest.fn<
  Promise<{ accounts: { id: string; impl: string; address: string }[] }>,
  []
>();
const mockGetKycAddress = jest.fn<Promise<string | undefined>, []>();
const mockCheckAccounts = jest.fn<Promise<boolean>, [unknown]>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAllAccounts: () => mockGetAllAccounts() },
    serviceStaking: {
      getEthenaKycAddress: () => mockGetKycAddress(),
      checkEthenaKycStatusByAccounts: (params: unknown) =>
        mockCheckAccounts(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isWatchingAccount: ({ accountId }: { accountId: string }) =>
      accountId === 'watch',
  },
}));

describe('useCheckEthenaKycStatus', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKycAddress.mockResolvedValue(undefined);
    mockGetAllAccounts.mockResolvedValue({ accounts: [] });
    mockCheckAccounts.mockResolvedValue(false);
  });

  it('only looks up KYC for Ethena and skips the scan when an address is cached', async () => {
    const { rerender } = renderHook(
      ({ provider }: { provider: string }) =>
        useCheckEthenaKycStatus({ provider, refreshEarnDetailData: refresh }),
      { initialProps: { provider: 'Falcon' } },
    );
    expect(mockGetKycAddress).not.toHaveBeenCalled();
    mockGetKycAddress.mockResolvedValue('0xcached');
    rerender({ provider: 'eThEnA' });
    await waitFor(() => expect(mockGetKycAddress).toHaveBeenCalledTimes(1));
    expect(mockGetAllAccounts).not.toHaveBeenCalled();
    expect(mockCheckAccounts).not.toHaveBeenCalled();
  });

  it('scans non-watching EVM accounts with the existing address and deduplication semantics', async () => {
    mockGetAllAccounts.mockResolvedValue({
      accounts: [
        { id: 'a', impl: 'evm', address: '0xAbC' },
        { id: 'duplicate', impl: 'evm', address: '0xAbC' },
        { id: 'different-case', impl: 'evm', address: '0xabc' },
        { id: 'watch', impl: 'evm', address: '0xwatch' },
        { id: 'non-evm', impl: 'btc', address: '0xbtc' },
        { id: 'empty', impl: 'evm', address: '  ' },
      ],
    });
    renderHook(() =>
      useCheckEthenaKycStatus({
        provider: 'ETHENA',
        refreshEarnDetailData: refresh,
      }),
    );
    await waitFor(() =>
      expect(mockCheckAccounts).toHaveBeenCalledWith({
        accounts: [
          { accountAddress: '0xAbC', networkId: 'evm--1' },
          { accountAddress: '0xabc', networkId: 'evm--1' },
        ],
      }),
    );
    expect(mockGetAllAccounts).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('still sends an empty account list and refreshes 500ms after a positive result', async () => {
    jest.useFakeTimers();
    try {
      mockCheckAccounts.mockResolvedValue(true);
      await act(async () => {
        renderHook(() =>
          useCheckEthenaKycStatus({
            provider: 'Ethena',
            refreshEarnDetailData: refresh,
          }),
        );
      });
      expect(mockCheckAccounts).toHaveBeenCalledWith({ accounts: [] });
      act(() => jest.advanceTimersByTime(499));
      expect(refresh).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(1));
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
