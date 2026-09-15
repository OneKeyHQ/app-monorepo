/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  clearRecentRecipientsCache,
  useRecentRecipientsData,
} from './useRecentRecipientsData';

const fetchTransferRecipients = jest.fn<Promise<unknown>, unknown[]>();
const getRecentRecipients = jest.fn<Promise<unknown>, unknown[]>();
const queryAddress = jest.fn<Promise<unknown>, [{ address: string }]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchTransferRecipients: (...args: unknown[]) =>
        fetchTransferRecipients(...args),
    },
    serviceSignatureConfirm: {
      getRecentRecipients: (...args: unknown[]) => getRecentRecipients(...args),
    },
    serviceAccountProfile: {
      queryAddress: (params: { address: string }) => queryAddress(params),
    },
    serviceNetwork: {
      getNetworkSafe: async ({ networkId }: { networkId: string }) => ({
        name: networkId,
      }),
    },
  },
}));

const ACCOUNT_ID = "hd-1--m/44'/118'/0'/0/0";
const COSMOS = 'cosmos--cosmoshub-4';
const ETH = 'evm--1';
const RECIPIENT = '0x1111111111111111111111111111111111111111';

function mountHook(networkId: string) {
  return renderHook(() =>
    useRecentRecipientsData({ accountId: ACCOUNT_ID, networkId }),
  );
}

// Let a background refresh finish so its state updates land inside act().
async function flushBackgroundLoad() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('useRecentRecipientsData session cache', () => {
  beforeEach(() => {
    clearRecentRecipientsCache();
    fetchTransferRecipients.mockReset();
    getRecentRecipients.mockReset();
    queryAddress.mockReset();
    getRecentRecipients.mockResolvedValue([]);
    queryAddress.mockImplementation(
      async ({ address }: { address: string }) => ({
        input: address,
        validAddress: address,
      }),
    );
  });

  it('skips the API on later loads once the server reports it unsupported', async () => {
    fetchTransferRecipients.mockResolvedValue({ supported: false, data: [] });

    const first = mountHook(COSMOS);
    expect(first.result.current.isLoadingRecent).toBe(true);
    await waitFor(() =>
      expect(first.result.current.isLoadingRecent).toBe(false),
    );
    expect(fetchTransferRecipients).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = mountHook(COSMOS);
    // Cached: no skeleton on re-entry.
    expect(second.result.current.isLoadingRecent).toBe(false);
    await waitFor(() => expect(getRecentRecipients).toHaveBeenCalledTimes(2));
    expect(fetchTransferRecipients).toHaveBeenCalledTimes(1);
    await flushBackgroundLoad();
  });

  it('retries the API when the previous unsupported answer came from a failed request', async () => {
    fetchTransferRecipients.mockResolvedValue({
      supported: false,
      data: [],
      errored: true,
    });

    const first = mountHook(COSMOS);
    await waitFor(() =>
      expect(first.result.current.isLoadingRecent).toBe(false),
    );
    first.unmount();

    mountHook(COSMOS);
    await waitFor(() =>
      expect(fetchTransferRecipients).toHaveBeenCalledTimes(2),
    );
    await flushBackgroundLoad();
  });

  it('paints the cached list immediately and refreshes in the background', async () => {
    fetchTransferRecipients.mockResolvedValue({
      supported: true,
      data: [{ address: RECIPIENT, time: 1, networkId: ETH }],
    });

    const first = mountHook(ETH);
    await waitFor(() =>
      expect(first.result.current.recentRecipients).toHaveLength(1),
    );
    expect(first.result.current.isLoadingRecent).toBe(false);
    first.unmount();

    const second = mountHook(ETH);
    expect(second.result.current.isLoadingRecent).toBe(false);
    expect(second.result.current.recentRecipients[0]?.input).toBe(RECIPIENT);
    await waitFor(() =>
      expect(fetchTransferRecipients).toHaveBeenCalledTimes(2),
    );
    await flushBackgroundLoad();
    expect(second.result.current.recentRecipients).toHaveLength(1);
    expect(getRecentRecipients).not.toHaveBeenCalled();
  });

  it('does not reuse a cache entry across accounts or networks', async () => {
    fetchTransferRecipients.mockResolvedValue({
      supported: true,
      data: [{ address: RECIPIENT, time: 1, networkId: ETH }],
    });
    const first = mountHook(ETH);
    await waitFor(() =>
      expect(first.result.current.recentRecipients).toHaveLength(1),
    );
    first.unmount();

    const other = mountHook(COSMOS);
    expect(other.result.current.isLoadingRecent).toBe(true);
    expect(other.result.current.recentRecipients).toHaveLength(0);
    await flushBackgroundLoad();
  });
});
