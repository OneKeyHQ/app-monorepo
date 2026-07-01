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
  const withAssetType =
    (type: EDeFiAssetType) =>
    (asset: IDeFiAsset): IDeFiAsset & { type: EDeFiAssetType } => ({
      ...asset,
      type,
    });

  return {
    groupId: sourcePosition.groupId,
    category: sourcePosition.category,
    poolName: sourcePosition.name,
    poolFullName: sourcePosition.name,
    assets: sourcePosition.assets.map(withAssetType(EDeFiAssetType.ASSET)),
    debts: sourcePosition.debts.map(withAssetType(EDeFiAssetType.DEBT)),
    rewards: sourcePosition.rewards.map(withAssetType(EDeFiAssetType.REWARD)),
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

describe('defiActionUtils.resolveDeFiPositionActionDebugCandidates', () => {
  it('returns only protocol-supported actions that normal resolution hides', () => {
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'yield',
        rewardCategory: 'reward',
        action: EDeFiPositionAction.Claim,
      },
    ];

    const debugCandidates =
      defiActionUtils.resolveDeFiPositionActionDebugCandidates({
        protocol: {
          networkId: 'evm--1',
          protocol: 'morpho-blue',
        },
        position: makePosition(makeSourcePosition()),
        supportedActions,
      });

    expect(debugCandidates).toHaveLength(1);
    expect(debugCandidates[0]).toEqual(
      expect.objectContaining({
        protocolId: 'morphoblue',
        action: EDeFiPositionAction.Claim,
        assets: [],
      }),
    );
  });

  it('returns metadata-gated actions as empty debug candidates', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      // No tokenId in the groupId: removeLiquidity can't build a tx, so it
      // resolves to empty assets (a debug candidate) rather than a live button.
      groupId: 'uniswap-v3-position',
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

    const debugCandidates =
      defiActionUtils.resolveDeFiPositionActionDebugCandidates({
        protocol: {
          networkId: 'evm--1',
          protocol: 'uniswap-v3',
        },
        position: makePosition(sourcePosition),
        supportedActions,
      });

    expect(debugCandidates).toHaveLength(1);
    expect(debugCandidates[0].action).toBe(EDeFiPositionAction.RemoveLiquidity);
    expect(debugCandidates[0].assets).toEqual([]);
  });

  it('returns proxy-hidden actions as empty debug candidates', () => {
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
    ];

    const debugCandidates =
      defiActionUtils.resolveDeFiPositionActionDebugCandidates({
        protocol: {
          networkId: 'evm--1',
          protocol: 'morpho-blue',
        },
        position: makePosition(
          makeSourcePosition({
            proxyDetail: {
              project: {
                id: 'defisaver',
                name: 'DeFi Saver',
              },
              proxyContractId: '0xf1293ed7a84a32445ef03a8734cd5d279664b27c',
            },
          }),
        ),
        supportedActions,
      });

    expect(debugCandidates).toHaveLength(1);
    expect(debugCandidates[0]).toEqual(
      expect.objectContaining({
        action: EDeFiPositionAction.Withdraw,
        assets: [],
      }),
    );
  });

  it('keeps non-matching capabilities and permit actions hidden', () => {
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Permit,
      },
      {
        protocolId: 'morphoblue',
        networkId: 'evm--137',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
      {
        protocolId: 'spark',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
      {
        protocolId: 'morphoblue',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
    ];

    const debugCandidates =
      defiActionUtils.resolveDeFiPositionActionDebugCandidates({
        protocol: {
          networkId: 'evm--1',
          protocol: 'morpho-blue',
        },
        position: makePosition(makeSourcePosition()),
        supportedActions,
      });

    expect(debugCandidates).toHaveLength(0);
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

  it('matches Debank stakedao ids with Stake DAO supported actions', () => {
    const poolAddress = '0xee26a99688474bbde401e784a01d89833c46aa14';
    const sourcePosition = makeSourcePosition({
      protocol: 'stakedao',
      protocolName: 'Stake DAO',
      category: 'yield',
      groupId: poolAddress,
      name: 'Stake DAO Yield: CRV/cvxCRV Pool',
      contracts: {
        pool: poolAddress,
      },
      assets: [
        makeAsset({
          symbol: 'CRV',
          address: '0xd533a949740bb3306d119cc777fa900ba034cd52',
          amount: '1.3371022039162819',
          category: 'deposit',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'stake-dao',
        networkId: 'evm--1',
        positionCategory: 'yield',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'stakedao',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].protocolId).toBe('stake-dao');
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe(poolAddress);
  });

  it('resolves Aave repay from debtCategory debts instead of collateral assets', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'aave-v3',
      protocolName: 'Aave V3',
      category: 'lending',
      groupId: 'aave-v3-lending',
      name: 'Aave V3 Lending',
      poolAddress: '0xaavepool',
      assets: [
        makeAsset({
          symbol: 'USDC',
          address: '0xusdc',
          amount: '100',
          category: 'collateral',
        }),
      ],
      debts: [
        makeAsset({
          symbol: 'DAI',
          address: '0xdai',
          amount: '25',
          category: 'variable-debt',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'aave-v3',
        networkId: 'evm--1',
        positionCategory: 'lending',
        assetCategory: 'collateral',
        action: EDeFiPositionAction.Withdraw,
      },
      {
        protocolId: 'aave-v3',
        networkId: 'evm--1',
        positionCategory: 'lending',
        debtCategory: 'variable-debt',
        action: EDeFiPositionAction.Repay,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'aave-v3',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });
    const repayAction = actions.find(
      (action) => action.action === EDeFiPositionAction.Repay,
    );

    expect(repayAction).toEqual(
      expect.objectContaining({
        debtCategory: 'variable-debt',
      }),
    );
    expect(repayAction?.assets).toHaveLength(1);
    expect(repayAction?.assets[0]).toEqual(
      expect.objectContaining({
        amount: '25',
        symbol: 'DAI',
        tokenAddress: '0xdai',
        extraParams: expect.objectContaining({
          poolAddress: '0xaavepool',
        }),
      }),
    );
  });

  it('hides Aave actions that the service rejects for Safe group ids', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'aave-v3',
      protocolName: 'Aave V3',
      category: 'lending',
      groupId: 'aave-v3#safe',
      name: 'Aave V3 Safe Lending',
      poolAddress: '0xaavepool',
      assets: [
        makeAsset({
          symbol: 'USDC',
          address: '0xusdc',
          amount: '100',
          category: 'collateral',
        }),
      ],
      debts: [
        makeAsset({
          symbol: 'DAI',
          address: '0xdai',
          amount: '25',
          category: 'variable-debt',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'aave-v3',
        networkId: 'evm--1',
        positionCategory: 'lending',
        assetCategory: 'collateral',
        action: EDeFiPositionAction.Withdraw,
      },
      {
        protocolId: 'aave-v3',
        networkId: 'evm--1',
        positionCategory: 'lending',
        debtCategory: 'variable-debt',
        action: EDeFiPositionAction.Repay,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'aave-v3',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(0);
  });

  it('hides actions for proxy positions that cannot finish in App', () => {
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
      position: makePosition(
        makeSourcePosition({
          proxyDetail: {
            project: {
              id: 'defisaver',
              name: 'DeFi Saver',
            },
            proxyContractId: '0xf1293ed7a84a32445ef03a8734cd5d279664b27c',
          },
        }),
      ),
      supportedActions,
    });

    expect(actions).toHaveLength(0);
  });

  it('resolves Uniswap removeLiquidity even when min-receive metadata is missing (enforced server-side)', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'Uniswap Position',
      assets: [
        makeAsset({
          symbol: 'ETH',
          address: '0xeth',
          amount: '0.5',
          value: 1500,
          price: 3000,
        }),
        makeAsset({
          symbol: 'USDC',
          address: '0xusdc',
          amount: '1500',
          value: 1500,
          price: 1,
        }),
      ],
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

    // Min-receive is no longer gated client-side; the action resolves on tokenId
    // alone and the build service enforces slippage.
    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams).toEqual(
      expect.objectContaining({ tokenId: '123' }),
    );
  });

  it('resolves Uniswap V3 removeLiquidity when tokenId and min-receive metadata are available', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'Uniswap Position',
      extraParams: {
        amount0Min: '0.49',
        amount1Min: '1490',
      },
      assets: [
        makeAsset({
          symbol: 'ETH',
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          amount: '0.5',
          value: 1500,
          price: 3000,
        }),
        makeAsset({
          symbol: 'USDC',
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          amount: '1500',
          value: 1500,
          price: 1,
        }),
      ],
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
    expect(actions[0].assets[0]).toEqual(
      expect.objectContaining({
        underlyingAssets: sourcePosition.assets,
        extraParams: expect.objectContaining({
          amount0Min: '0.49',
          amount1Min: '1490',
          tokenId: '123',
        }),
      }),
    );
  });

  it('hides Uniswap removeLiquidity when tokenId metadata is missing', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: 'uniswap-v3-position',
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

    expect(actions).toHaveLength(0);
  });

  it('resolves Uniswap V4 removeLiquidity without currency metadata', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'uniswap-v4',
      protocolName: 'Uniswap V4',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'Uniswap Position',
      extraParams: {
        amount0Min: '1',
        amount1Min: '1',
      },
      assets: [makeAsset({ symbol: 'UNI-LP', address: '0xlp' })],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'uniswap-v4',
        networkId: 'evm--1',
        positionCategory: 'liquidity',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.RemoveLiquidity,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'uniswap-v4',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams).toEqual(
      expect.objectContaining({
        amount0Min: '1',
        amount1Min: '1',
        groupId: '0x1111111111111111111111111111111111111111#123',
        tokenId: '123',
      }),
    );
    expect(actions[0].assets[0].extraParams).not.toHaveProperty('currency0');
    expect(actions[0].assets[0].extraParams).not.toHaveProperty('currency1');
  });

  it('resolves Uniswap V4 removeLiquidity when one currency is the native empty address', () => {
    const tokenAddress = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
    const sourcePosition = makeSourcePosition({
      networkId: 'evm--137',
      protocol: 'uniswap-v4',
      protocolName: 'Uniswap V4',
      category: 'liquidity',
      groupId: '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9#23973',
      name: 'Uniswap V4 POL/USDC Pool (#23973)',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '',
          amount: '8.228050923106608',
          value: 1,
          price: 1,
        }),
        makeAsset({
          symbol: 'USDC',
          address: tokenAddress,
          amount: '0.573641',
          value: 1,
          price: 1,
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'uniswap-v4',
        networkId: 'evm--137',
        positionCategory: 'liquidity',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.RemoveLiquidity,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--137',
        protocol: 'uniswap-v4',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams).toEqual(
      expect.objectContaining({
        groupId: '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9#23973',
        tokenId: '23973',
      }),
    );
    expect(actions[0].assets[0].extraParams).not.toHaveProperty('currency0');
    expect(actions[0].assets[0].extraParams).not.toHaveProperty('currency1');
  });

  it('resolves grouped Uniswap removeLiquidity source positions independently', () => {
    const firstSourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x1111111111111111111111111111111111111111#123',
      name: 'ETH / USDC',
      extraParams: {
        amount0Min: '0.49',
        amount1Min: '1490',
      },
      assets: [makeAsset({ symbol: 'UNI-LP', address: '0xlp' })],
    });
    const secondSourcePosition = makeSourcePosition({
      protocol: 'uniswap-v3',
      protocolName: 'Uniswap V3',
      category: 'liquidity',
      groupId: '0x2222222222222222222222222222222222222222#456',
      name: 'ETH / USDC',
      extraParams: {
        amount0Min: '0.24',
        amount1Min: '745',
      },
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

  it('hides Polygon pending cooldown rows until they become claimable', () => {
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

    expect(actions).toHaveLength(0);
  });

  it('resolves Polygon withdraw only from Debank staked groupId assets', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      groupId: 'validator#staked',
      name: 'Polygon Staked',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'deposit',
          poolAddress: '0xvalidator',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
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
  });

  it('resolves Polygon withdraw pool address from Debank staked groupId prefix', () => {
    const validatorShareAddress = '0x8f846c443cfa44a6e95aacd2ac362b6cf4fd4335';
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      groupId: `${validatorShareAddress}#staked`,
      name: 'Staked',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'deposit',
          poolAddress: undefined,
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
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
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe(
      validatorShareAddress,
    );
  });

  it('resolves Polygon claim pool address from Debank staked groupId prefix', () => {
    const validatorShareAddress = '0x8f846c443cfa44a6e95aacd2ac362b6cf4fd4335';
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      groupId: `${validatorShareAddress}#staked`,
      name: 'Staked',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'deposit',
          poolAddress: undefined,
        }),
      ],
      rewards: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'liquidity-mining',
          poolAddress: undefined,
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'liquidity-mining',
        action: EDeFiPositionAction.Claim,
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
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe(
      validatorShareAddress,
    );
  });

  it('hides Polygon withdraw for Debank unbonded groupId assets', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      // oxlint-disable-next-line @cspell/spellchecker
      groupId: 'validator#new_version_unbonded_10',
      name: 'Polygon Withdrawal',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'deposit',
          poolAddress: '0xvalidator',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'polygon_staking',
        networkId: 'evm--1',
        positionCategory: 'staking',
        assetCategory: 'deposit',
        action: EDeFiPositionAction.Withdraw,
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

    expect(actions).toHaveLength(0);
  });

  it('resolves Polygon claimWithdrawal from Debank unbonded groupId assets', () => {
    const validatorShareAddress = '0x8f846c443cfa44a6e95aacd2ac362b6cf4fd4335';
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      // oxlint-disable-next-line @cspell/spellchecker
      groupId: `${validatorShareAddress}#new_version_unbonded_10`,
      name: 'Polygon Withdrawal',
      assets: [
        makeAsset({
          symbol: 'POL',
          address: '0xpol',
          category: 'deposit',
          poolAddress: undefined,
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

    // oxlint-disable-next-line @cspell/spellchecker
    const claimableWithdrawalGroupId = `${validatorShareAddress}#new_version_unbonded_10`;

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe(
      validatorShareAddress,
    );
    expect(actions[0].assets[0].extraParams?.groupId).toBe(
      claimableWithdrawalGroupId,
    );
  });

  it('matches the remote Everstake claimWithdrawal category typo defensively', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'everstake',
      protocolName: 'Everstake',
      category: 'locked',
      groupId: 'everstake-eth-withdrawal',
      name: 'Everstake Pending Withdrawal',
      assets: [
        makeAsset({
          symbol: 'ETH',
          address: '0xeth',
          category: 'deposit',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'everstake',
        networkId: 'evm--1',
        positionCategory: 'locked',
        // oxlint-disable-next-line @cspell/spellchecker
        assetCategory: 'deopsit',
        action: EDeFiPositionAction.ClaimWithdrawal,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'everstake',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].symbol).toBe('ETH');
  });

  it('does not pass Polygon unbond nonces for claimWithdrawal', () => {
    const validatorShareAddress = '0x8f846c443cfa44a6e95aacd2ac362b6cf4fd4335';
    const sourcePosition = makeSourcePosition({
      protocol: 'polygon_staking',
      protocolName: 'Polygon Staking',
      category: 'staking',
      // oxlint-disable-next-line @cspell/spellchecker
      groupId: `${validatorShareAddress}#new_version_unbonded_10`,
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
    expect(actions[0].assets[0].extraParams?.['unbondNonces']).toBeUndefined();
    expect(actions[0].assets[0].extraParams?.groupId).toBe(
      // oxlint-disable-next-line @cspell/spellchecker
      `${validatorShareAddress}#new_version_unbonded_10`,
    );
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

  it('hides non-Polygon pool-address-gated withdraw actions when only groupId has an address', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'fluid',
      protocolName: 'Fluid',
      category: 'yield',
      groupId: '0x1111111111111111111111111111111111111111#vault',
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

  it('hides Stake DAO claim when pool metadata is missing', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'stake_dao',
      protocolName: 'Stake DAO',
      category: 'yield',
      groupId: '0x1111111111111111111111111111111111111111#gauge',
      rewards: [
        makeAsset({
          symbol: 'SDT',
          address: '0xsdt',
          category: 'liquidity-mining',
          poolAddress: undefined,
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'stake_dao',
        networkId: 'evm--1',
        positionCategory: 'yield',
        rewardCategory: 'liquidity-mining',
        action: EDeFiPositionAction.Claim,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'stake_dao',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(0);
  });

  it('resolves Stake DAO claim when pool metadata is available', () => {
    const sourcePosition = makeSourcePosition({
      protocol: 'stake_dao',
      protocolName: 'Stake DAO',
      category: 'yield',
      rewards: [
        makeAsset({
          symbol: 'SDT',
          address: '0xsdt',
          category: 'liquidity-mining',
          poolAddress: '0xgauge',
        }),
      ],
    });
    const supportedActions: IDeFiSupportedProtocolAction[] = [
      {
        protocolId: 'stake_dao',
        networkId: 'evm--1',
        positionCategory: 'yield',
        rewardCategory: 'liquidity-mining',
        action: EDeFiPositionAction.Claim,
      },
    ];

    const actions = defiActionUtils.resolveDeFiPositionActions({
      protocol: {
        networkId: 'evm--1',
        protocol: 'stake_dao',
      },
      position: makePosition(sourcePosition),
      supportedActions,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].assets[0].extraParams?.poolAddress).toBe('0xgauge');
  });
});

describe('defiActionUtils.scopeResolvedActionToAsset', () => {
  const action = {
    action: EDeFiPositionAction.Withdraw,
    protocolId: 'aave_v3',
    networkId: 'evm--1',
    positionCategory: 'lending',
    assets: [
      {
        asset: makeAsset({ address: '0xAAA', symbol: 'USDC' }),
        amount: '1',
        symbol: 'USDC',
        tokenAddress: '0xAAA',
      },
      {
        // No tokenAddress: must fall back to asset.address.
        asset: makeAsset({ address: '0xBBB', symbol: 'WETH' }),
        amount: '2',
        symbol: 'WETH',
      },
    ],
  };

  it('narrows the action to the matching token (case-insensitive)', () => {
    const scoped = defiActionUtils.scopeResolvedActionToAsset({
      action,
      tokenAddress: '0xaaa',
    });
    expect(scoped?.assets).toHaveLength(1);
    expect(scoped?.assets[0].symbol).toBe('USDC');

    const fallback = defiActionUtils.scopeResolvedActionToAsset({
      action,
      tokenAddress: '0xbbb',
    });
    expect(fallback?.assets).toHaveLength(1);
    expect(fallback?.assets[0].symbol).toBe('WETH');
  });

  it('returns undefined when no asset matches or address is empty', () => {
    expect(
      defiActionUtils.scopeResolvedActionToAsset({
        action,
        tokenAddress: '0xCCC',
      }),
    ).toBeUndefined();
    expect(
      defiActionUtils.scopeResolvedActionToAsset({
        action,
        tokenAddress: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('defiActionUtils.resolveDeFiActionTxAmount', () => {
  it('sends the exact amount for a manual partial entry', () => {
    expect(
      defiActionUtils.resolveDeFiActionTxAmount({
        percentageAction: true,
        amount: ' 12.5 ',
      }),
    ).toEqual({ amount: '12.5' });
  });

  it('sends bps=10000 for a full (Max) close, ignoring the typed amount', () => {
    expect(
      defiActionUtils.resolveDeFiActionTxAmount({
        percentageAction: true,
        amount: '12.5',
        isMaxAmount: true,
      }),
    ).toEqual({ bps: '10000' });
  });

  it('sends bps from the slider percent when no amount is entered', () => {
    expect(
      defiActionUtils.resolveDeFiActionTxAmount({
        percentageAction: true,
        percent: 50,
      }),
    ).toEqual({ bps: '5000' });
  });

  it('treats a non-positive amount as not-a-manual-amount (falls back to bps)', () => {
    expect(
      defiActionUtils.resolveDeFiActionTxAmount({
        percentageAction: true,
        amount: '0',
        percent: 25,
      }),
    ).toEqual({ bps: '2500' });
  });

  it('sends neither for non-percentage actions', () => {
    expect(
      defiActionUtils.resolveDeFiActionTxAmount({
        percentageAction: false,
        amount: '12.5',
      }),
    ).toEqual({});
  });
});
