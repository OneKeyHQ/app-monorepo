import {
  EDeFiAssetType,
  EDeFiPositionAction,
  type IDeFiAsset,
  type IDeFiPosition,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
} from '../../types/defi';

import defiActionUtils from './defiActionUtils';

function makeAsset(overrides: Partial<IDeFiAsset> = {}): IDeFiAsset {
  return {
    symbol: 'USDC',
    address: '0xusdc',
    amount: '1',
    value: 1,
    price: 1,
    category: 'deposit',
    meta: {
      decimals: 6,
      isVerified: true,
    },
    ...overrides,
  };
}

function makeSourcePosition(
  overrides: Partial<IDeFiPosition> = {},
): IDeFiPosition {
  return {
    networkId: 'evm--1',
    owner: '0xowner',
    protocol: 'morpho-blue',
    protocolName: 'Morpho',
    chain: 'ethereum',
    category: 'yield',
    assets: [makeAsset({ poolAddress: '0xpool' })],
    debts: [],
    rewards: [],
    metrics: {
      healthFactor: null,
    },
    source: {
      provider: 'debank',
      fetchedAt: '2026-06-03T00:00:00.000Z',
      ttl: 60_000,
      cached: false,
    },
    groupId: 'morpho-blue#1',
    name: 'Morpho Vault',
    ...overrides,
  };
}

function makePosition(
  sourcePosition: IDeFiPosition,
): IDeFiProtocol['positions'][number] {
  const withAssetType = (asset: IDeFiAsset) => ({
    ...asset,
    type: EDeFiAssetType.ASSET,
  });

  return {
    groupId: sourcePosition.groupId,
    category: sourcePosition.category,
    poolName: sourcePosition.name,
    poolFullName: sourcePosition.name,
    assets: sourcePosition.assets.map(withAssetType),
    debts: sourcePosition.debts.map(withAssetType),
    rewards: sourcePosition.rewards.map(withAssetType),
    value: '1',
    sourcePositions: [sourcePosition],
  };
}

describe('defiActionUtils.buildDeFiActionBps', () => {
  it('converts percentage input into bps strings', () => {
    expect(defiActionUtils.buildDeFiActionBps()).toBe('10000');
    expect(defiActionUtils.buildDeFiActionBps(1)).toBe('100');
    expect(defiActionUtils.buildDeFiActionBps(50)).toBe('5000');
    expect(defiActionUtils.buildDeFiActionBps(100)).toBe('10000');
  });

  it('rejects percentages outside the backend bps range', () => {
    expect(defiActionUtils.buildDeFiActionBps(0)).toBeUndefined();
    expect(defiActionUtils.buildDeFiActionBps(101)).toBeUndefined();
    expect(defiActionUtils.buildDeFiActionBps(Number.NaN)).toBeUndefined();
  });
});

describe('defiActionUtils.resolveDeFiPositionActions', () => {
  it('matches Debank morphoblue ids with morpho-blue positions', () => {
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'morpho-blue',
      },
      position: makePosition(makeSourcePosition()),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].protocolId).toBe('morphoblue');
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe('0xpool');
  });

  it('preserves Debank groupId for Uniswap removeLiquidity', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'Uniswap Position',
      assets: [makeAsset({ symbol: 'UNI-LP', address: '0xlp' })],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'uniswap-v3',
        networkId: 'evm--1',
        positionCategory: 'liquidity',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.RemoveLiquidity,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'uniswap-v3',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams?.groupId).toBe(
      '0x1111111111111111111111111111111111111111#123',
    );
    expect(actions[0].assets[0].extraParams?.tokenId).toBe('123');
  });

  it('resolves multiple Uniswap removeLiquidity assets from grouped source positions', () => {
    const firstSourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'ETH / USDC',
      assets: [makeAsset({ symbol: 'UNI-LP', address: '0xlp' })],
    });
    const secondSourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x2222222222222222222222222222222222222222#456',
      name: 'ETH / USDC',
      assets: [makeAsset({ symbol: 'UNI-LP', address: '0xlp' })],
    });
    const position = {
      ...makePosition(firstSourcePosition),
      sourcePositions: [firstSourcePosition, secondSourcePosition],
    };
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'uniswap-v3',
        networkId: 'evm--1',
        positionCategory: 'liquidity',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.RemoveLiquidity,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'uniswap-v3',
      },
      position,
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets).toHaveLength(2);
    expect(
      actions[0].assets.map((asset) => asset.extraParams?.tokenId),
    ).toEqual(['123', '456']);
  });

  it('resolves Polygon claimWithdrawal with pool and unbond nonce metadata', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      groupId: 'Cooldown #5',
      name: 'Cooldown #5',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'staking',
          poolAddress: '0xvalidator',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'staking',
        action: EDeFiPositionAction.ClaimWithdrawal,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'polygon_staking',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe('0xvalidator');
    // oxlint-disable-next-line @cspell/spellchecker
    expect(actions[0].assets[0].extraParams?.unbondNonces).toEqual(['5']);
  });

  it('passes only one Polygon unbond nonce per claimWithdrawal transaction', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      groupId: 'polygon-cooldowns',
      name: 'Polygon Cooldowns',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'staking',
          poolAddress: '0xvalidator',
          extraParams: {
            // oxlint-disable-next-line @cspell/spellchecker
            unbondNonces: ['5', '6'],
          },
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'staking',
        action: EDeFiPositionAction.ClaimWithdrawal,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'polygon_staking',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    // oxlint-disable-next-line @cspell/spellchecker
    expect(actions[0].assets[0].extraParams?.unbondNonces).toEqual(['5']);
  });

  it('resolves Ethena claimWithdrawal when pool metadata is available', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'ethena',
      protocolName: 'Ethena',
      category: 'locked',
      groupId: 'ethena-pending',
      name: 'Ethena Pending',
      assets: [
        makeAsset({
          symbol: 'USDe',
          address: '0xusde:pending',
          category: 'locked',
          poolAddress: '0xstakedusde',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'ethena',
        networkId: 'evm--1',
        positionCategory: 'locked',
        assetCategory: 'locked',
        action: EDeFiPositionAction.ClaimWithdrawal,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'ethena',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe('0xstakedusde');
  });

  it('hides pool-address-gated withdraw actions when metadata is missing', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'fluid',
      protocolName: 'Fluid',
      category: 'yield',
      assets: [
        makeAsset({
          symbol: 'fUSDC',
          address: '0xfusdc',
          category: 'deposit',
          poolAddress: undefined,
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'fluid',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'fluid',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(0);
  });
});
