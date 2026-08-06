/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISwapRecordsResponse } from '@onekeyhq/shared/src/referralCode/type';

const globalMockBag = globalThis as typeof globalThis & {
  __swapRewardBg?: {
    serviceReferralCode: {
      getSwapRecords: jest.Mock;
    };
  };
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const proxy = {
    serviceReferralCode: {
      getSwapRecords: jest.fn(),
    },
  };
  (
    globalThis as typeof globalThis & {
      __swapRewardBg?: typeof proxy;
    }
  ).__swapRewardBg = proxy;
  return {
    __esModule: true,
    default: proxy,
  };
});

import { useSwapRecordDetails } from './useSwapRecordDetails';

function createResponse(fiatValue: string): ISwapRecordsResponse {
  return {
    total: 0,
    fiatValue,
    items: [],
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useSwapRecordDetails', () => {
  const getSwapRecords = globalMockBag.__swapRewardBg?.serviceReferralCode
    .getSwapRecords as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads lazily and reuses the current query result', async () => {
    const response = createResponse('1');
    getSwapRecords.mockResolvedValue(response);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useSwapRecordDetails({
          enabled,
          inviteeId: 'invitee-1',
          query: { inviteCode: 'CODE' },
          status: 'AVAILABLE',
        }),
      {
        initialProps: { enabled: false },
      },
    );

    expect(getSwapRecords).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.records).toBe(response));
    expect(getSwapRecords).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.records).toBe(response);
    expect(getSwapRecords).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale response after the query changes', async () => {
    const firstRequest = createDeferred<ISwapRecordsResponse>();
    const secondRequest = createDeferred<ISwapRecordsResponse>();
    getSwapRecords
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ inviteCode }) =>
        useSwapRecordDetails({
          enabled: true,
          inviteeId: 'invitee-1',
          query: { inviteCode },
          status: 'AVAILABLE',
        }),
      {
        initialProps: { inviteCode: 'FIRST' },
      },
    );

    await waitFor(() => expect(getSwapRecords).toHaveBeenCalledTimes(1));
    rerender({ inviteCode: 'SECOND' });
    await waitFor(() => expect(getSwapRecords).toHaveBeenCalledTimes(2));

    const secondResponse = createResponse('2');
    await act(async () => {
      secondRequest.resolve(secondResponse);
      await secondRequest.promise;
    });
    await waitFor(() => expect(result.current.records).toBe(secondResponse));

    await act(async () => {
      firstRequest.resolve(createResponse('1'));
      await firstRequest.promise;
    });
    expect(result.current.records).toBe(secondResponse);
  });

  it('retries after a request failure', async () => {
    const response = createResponse('3');
    getSwapRecords
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce(response);

    const { result } = renderHook(() =>
      useSwapRecordDetails({
        enabled: true,
        inviteeId: 'invitee-1',
        query: {},
        status: undefined,
      }),
    );

    await waitFor(() => expect(result.current.hasError).toBe(true));

    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.records).toBe(response));
    expect(result.current.hasError).toBe(false);
  });
});
