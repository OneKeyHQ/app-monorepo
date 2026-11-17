/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useEtherFiLegacyActionGuard } from './useEtherFiLegacyActionGuard';

const mockRevoke = jest.fn();
const mockRefresh = jest.fn();
const mockToast = jest.fn();
const mockVerify = jest.fn();
const mockIsActionAllowed = jest.fn();
let mockStatus: 'required' | 'pending' | 'unknown' | 'checking' | 'clear';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: (params: unknown) => {
      mockToast(params);
    },
  },
}));
jest.mock('./useEtherFiLegacyApproval', () => ({
  useEtherFiLegacyApproval: () => ({
    status: mockStatus,
    blocked: mockStatus !== 'clear',
    revoke: mockRevoke,
    refresh: mockRefresh,
    verifyBeforeAction: mockVerify,
    isActionAllowed: mockIsActionAllowed,
  }),
}));

describe('EtherFi legacy approval action', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['required', 'pending', 'unknown'] as const)(
    'exposes the appropriate user action while %s',
    (status) => {
      mockStatus = status;
      const { result } = renderHook(() =>
        useEtherFiLegacyActionGuard({ accountId: 'a', networkId: 'evm--1' }),
      );
      expect(result.current.action).toBeDefined();
      act(() => result.current.action?.onPress());
      if (status === 'required') {
        expect(mockRevoke).toHaveBeenCalledTimes(1);
        expect(mockRefresh).not.toHaveBeenCalled();
      } else {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('requires verification before continuing when the allowance is clear', () => {
    mockStatus = 'clear';
    const { result } = renderHook(() =>
      useEtherFiLegacyActionGuard({ accountId: 'a', networkId: 'evm--1' }),
    );
    expect(result.current.action).toBeUndefined();
    expect(result.current.blocked).toBe(false);
    expect(result.current.verifyBeforeAction).toBe(mockVerify);
    expect(result.current.isActionAllowed).toBe(mockIsActionAllowed);
  });
});
