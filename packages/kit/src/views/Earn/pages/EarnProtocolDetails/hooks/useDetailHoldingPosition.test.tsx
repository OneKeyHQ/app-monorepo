/* eslint-disable import/first */

let mockSelectedAddress = 0;
let mockCache: Record<string, unknown> = {};
let mockPublishedCache: Record<string, unknown> = {};
const mockReads: Array<(response: unknown) => void> = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getPortfolioPositions: () =>
        new Promise((resolve) => mockReads.push(resolve)),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'external-account',
        connectedAddresses: { evm: '0xaaa,0xbbb' },
        selectedAddress: { evm: mockSelectedAddress },
      },
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useEarnPortfolioPositionsAtom: () => {
      const value = React.useState(mockCache);
      mockPublishedCache = value[0];
      return value;
    },
  };
});
jest.mock('../../../hooks/useEarnAccountKey', () => ({
  useEarnAccountKey: () => 'wallet-key',
}));
jest.mock('../../EarnPositions/mobile/earnPositionModel', () => ({
  buildHoldingView: ({ sources }: { sources: unknown[] }) => sources[0],
}));

import { act, renderHook } from '@testing-library/react-native';

import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { useDetailHoldingPosition } from './useDetailHoldingPosition';

const identity = { networkId: 'evm--1', provider: 'morpho', symbol: 'USDC' };
const response = (id: string) => ({
  positions: {
    'evm--1': [{ id, earn: { manage: identity } }],
  },
  protocolSummaries: [],
  errors: [],
});
const account = (accountAddress: string) => ({
  accountId: 'external-account',
  networkId: 'evm--1',
  accountAddress,
  account: { pub: '' } as INetworkAccount,
});

describe('useDetailHoldingPosition account scope', () => {
  beforeEach(() => {
    mockSelectedAddress = 0;
    mockCache = {};
    mockPublishedCache = {};
    mockReads.length = 0;
  });

  it('drops an old address response and keeps only one address bucket', async () => {
    const { result, rerender } = renderHook(
      ({ earnAccount }: { earnAccount: ReturnType<typeof account> }) =>
        useDetailHoldingPosition({ identity, earnAccount, enabled: true }),
      { initialProps: { earnAccount: account('0xaaa') } },
    );
    let oldRequest: Promise<void> | undefined;
    act(() => {
      oldRequest = result.current.refresh();
    });
    mockSelectedAddress = 1;
    rerender({ earnAccount: account('0xbbb') });
    let newRequest: Promise<void> | undefined;
    act(() => {
      newRequest = result.current.refresh();
    });
    await act(async () => {
      mockReads[1](response('address-b'));
      await newRequest;
    });
    await act(async () => {
      mockReads[0](response('address-a-late'));
      await oldRequest;
    });
    expect(result.current.holding).toEqual(
      expect.objectContaining({ id: 'address-b' }),
    );
    expect(JSON.stringify(mockPublishedCache)).not.toContain('address-a-late');
    expect(JSON.stringify(mockPublishedCache)).toContain('address-b');

    mockSelectedAddress = 0;
    rerender({ earnAccount: account('0xaaa') });
    expect(result.current.holding).toBeUndefined();
  });

  it('treats a legacy cache bucket as a miss', () => {
    mockCache = { 'wallet-key': { legacy: response('legacy') } };
    const { result } = renderHook(() =>
      useDetailHoldingPosition({
        identity,
        earnAccount: undefined,
        enabled: true,
      }),
    );
    expect(result.current.holding).toBeUndefined();
  });

  it('does not accept an old response after switching away and back to the same address', async () => {
    const { result, rerender } = renderHook(
      ({ earnAccount }: { earnAccount: ReturnType<typeof account> }) =>
        useDetailHoldingPosition({ identity, earnAccount, enabled: true }),
      { initialProps: { earnAccount: account('0xaaa') } },
    );
    let oldRequest: Promise<void> | undefined;
    act(() => {
      oldRequest = result.current.refresh();
    });
    mockSelectedAddress = 1;
    rerender({ earnAccount: account('0xbbb') });
    mockSelectedAddress = 0;
    rerender({ earnAccount: account('0xaaa') });
    await act(async () => {
      mockReads[0](response('old-a'));
      await oldRequest;
    });
    expect(result.current.holding).toBeUndefined();
    expect(JSON.stringify(mockPublishedCache)).not.toContain('old-a');
  });

  it('reads a same-address bucket written by the positions page', () => {
    mockCache = {
      'wallet-key': {
        accountScope: JSON.stringify([
          'external-account',
          '',
          '',
          '',
          [{ evm: '0xaaa,0xbbb' }, { evm: 0 }],
        ]),
        scopes: { 'evm--1_morpho_0xaaa_': response('from-list') },
      },
    };
    const { result } = renderHook(() =>
      useDetailHoldingPosition({
        identity,
        earnAccount: account('0xaaa'),
        enabled: true,
      }),
    );
    expect(result.current.holding).toEqual(
      expect.objectContaining({ id: 'from-list' }),
    );
  });
});
