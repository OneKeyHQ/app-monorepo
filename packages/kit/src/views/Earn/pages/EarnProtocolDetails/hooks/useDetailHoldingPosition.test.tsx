/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getPortfolioPositions: jest.fn() } },
}));

jest.mock('../../../hooks/useEarnAccountKey', () => ({
  useEarnAccountKey: () => 'wallet',
}));

import { renderHook } from '@testing-library/react-native';

import { EDBAccountType } from '@onekeyhq/kit-bg/src/dbs/local/consts';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type { IProtocolInfo } from '@onekeyhq/shared/types/staking';

import { positionsScopeKey } from '../../EarnPositions/mobile/earnPortfolioPositions.utils';
import {
  position,
  token,
} from '../../EarnPositions/mobile/earnPositionModel.fixtures';

import { useDetailHoldingPosition } from './useDetailHoldingPosition';

const identity = { networkId: 'evm--1', provider: 'etherfi', symbol: 'ETH' };

const response = (name: string): IEarnPortfolioPositionsResponse => ({
  positions: {
    'evm--1': [
      position({
        networkId: 'evm--1',
        chain: 'evm',
        protocol: 'etherfi',
        protocolName: 'EtherFi',
        category: 'staked',
        groupId: name,
        name,
        assets: [token({ symbol: 'ETH', amount: '1', price: 1 })],
      }),
    ],
  },
  protocolSummaries: [],
  errors: [],
});

const scope = (accountAddress: string) =>
  positionsScopeKey({ ...identity, accountAddress });

const mockCache = {
  wallet: {
    [scope('0xa')]: response('account A'),
    [scope('0xb')]: response('account B'),
  },
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useEarnPortfolioPositionsAtom: () => useState(mockCache),
  };
});

function account(
  address: string,
  networkId = 'evm--1',
): IProtocolInfo['earnAccount'] {
  return {
    accountId: address,
    accountAddress: address,
    networkId,
    account: {
      id: address,
      name: address,
      address,
      pub: '',
      type: EDBAccountType.SIMPLE,
      path: '',
      coinType: '60',
      impl: 'evm',
      addressDetail: {
        isValid: true,
        networkId,
        address,
        baseAddress: address,
        normalizedAddress: address,
        displayAddress: address,
        allowEmptyAddress: false,
      },
    },
  };
}

describe('useDetailHoldingPosition account scope', () => {
  it('keeps a cached placeholder non-actionable until the current account resolves', () => {
    const { result, rerender } = renderHook(
      ({ earnAccount }: { earnAccount: IProtocolInfo['earnAccount'] }) =>
        useDetailHoldingPosition({ identity, earnAccount, enabled: true }),
      { initialProps: { earnAccount: undefined } },
    );

    expect(result.current.holding).toBeDefined();
    expect(result.current.actionableHolding).toBeUndefined();

    rerender({ earnAccount: account('0xa') });
    expect(result.current.actionableHolding?.source.name).toBe('account A');

    rerender({ earnAccount: undefined });
    expect(result.current.holding).toBeDefined();
    expect(result.current.actionableHolding).toBeUndefined();

    rerender({ earnAccount: account('0xb') });
    expect(result.current.actionableHolding?.source.name).toBe('account B');

    rerender({ earnAccount: account('0xc') });
    expect(result.current.holding).toBeUndefined();
    expect(result.current.actionableHolding).toBeUndefined();
  });

  it('does not make another network’s cached holding actionable', () => {
    const { result } = renderHook(() =>
      useDetailHoldingPosition({
        identity,
        earnAccount: account('0xa', 'evm--8453'),
        enabled: true,
      }),
    );
    expect(result.current.holding).toBeDefined();
    expect(result.current.actionableHolding).toBeUndefined();
  });
});
