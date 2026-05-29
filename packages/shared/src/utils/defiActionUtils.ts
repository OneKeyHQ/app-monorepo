import BigNumber from 'bignumber.js';

import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IDeFiAsset,
  type IDeFiPosition,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
  type IDeFiUnknownRecord,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '../../types/defi';

import {
  normalizeEvmAddress,
  normalizeTokenId,
  parsePoolPositionGroupId,
} from './defiPositionMetadataUtils';

type IResolveDeFiPositionActionsParams = {
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
};

function normalizeMatchValue(value?: string) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') ?? ''
  );
}

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  asset: 'deposit',
  collateral: 'deposit',
  supplied: 'deposit',
  supply: 'deposit',
  deposit: 'deposit',
  investment: 'deposit',
  stake: 'staking',
  staked: 'staking',
  staking: 'staking',
  nft_staked: 'staking',
  reward: 'reward',
  rewards: 'reward',
  staking_reward: 'reward',
  staking_rewards: 'reward',
  liquidity_mining: 'reward',
  liquidity: 'liquidity',
  liquidity_pool: 'liquidity',
  lp: 'liquidity',
  lending: 'lending',
  yield: 'yield',
};

const PROTOCOL_ALIAS_MAP: Record<string, string> = {
  aave_v3: 'aave_pool_v3',
  // oxlint-disable-next-line @cspell/spellchecker
  morphoblue: 'morpho_blue',
};

function normalizeCategoryForAction(value?: string) {
  const normalized = normalizeMatchValue(value);
  return CATEGORY_ALIAS_MAP[normalized] ?? normalized;
}

function normalizeProtocolForAction(value?: string) {
  const normalized = normalizeMatchValue(value);
  return PROTOCOL_ALIAS_MAP[normalized] ?? normalized;
}

function isProtocolMatch(expected?: string, actual?: string) {
  return (
    normalizeProtocolForAction(expected) === normalizeProtocolForAction(actual)
  );
}

function isCategoryMatch(expected?: string, actual?: string) {
  if (!expected) return true;
  return (
    normalizeCategoryForAction(expected) === normalizeCategoryForAction(actual)
  );
}

function isNormalizedProtocolId(protocolId: string, target: string) {
  return normalizeProtocolForAction(protocolId) === target;
}

function isPoolAddressRequired({
  protocolId,
  action,
}: {
  protocolId: string;
  action: EDeFiPositionAction;
}) {
  if (
    action !== EDeFiPositionAction.Withdraw &&
    action !== EDeFiPositionAction.Claim &&
    action !== EDeFiPositionAction.ClaimWithdrawal
  ) {
    return false;
  }

  return ['aave_pool_v3', 'morpho_blue', 'polygon_staking', 'spark'].includes(
    normalizeProtocolForAction(protocolId),
  );
}

function isPositiveAmount(amount?: string) {
  if (!amount) return false;
  const value = new BigNumber(amount);
  return value.isFinite() && value.gt(0);
}

function asRecord(value: unknown): IDeFiUnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as IDeFiUnknownRecord;
}

function pickStringFromRecord(
  record: IDeFiUnknownRecord | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function pickStringFromSources({
  sources,
  directKeys,
  nestedKeys,
}: {
  sources: unknown[];
  directKeys: string[];
  nestedKeys?: { containerKey: string; keys: string[] }[];
}) {
  for (const source of sources) {
    const record = asRecord(source);
    const directValue = pickStringFromRecord(record, directKeys);
    if (directValue) return directValue;

    for (const nestedKey of nestedKeys ?? []) {
      const nestedRecord = asRecord(record?.[nestedKey.containerKey]);
      const nestedValue = pickStringFromRecord(nestedRecord, nestedKey.keys);
      if (nestedValue) return nestedValue;
    }
  }
  return undefined;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    const values = value
      .map((item) => {
        if (typeof item === 'string' && item.trim()) return item.trim();
        if (typeof item === 'number' && Number.isFinite(item)) {
          return String(item);
        }
        return undefined;
      })
      .filter((item): item is string => Boolean(item));
    return values.length > 0 ? values : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)];
  }

  return undefined;
}

function pickStringArrayFromRecord(
  record: IDeFiUnknownRecord | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = normalizeStringArray(record[key]);
    if (value?.length) return value;
  }
  return undefined;
}

function pickStringArrayFromSources({
  sources,
  directKeys,
  nestedKeys,
}: {
  sources: unknown[];
  directKeys: string[];
  nestedKeys?: { containerKey: string; keys: string[] }[];
}) {
  for (const source of sources) {
    const record = asRecord(source);
    const directValue = pickStringArrayFromRecord(record, directKeys);
    if (directValue?.length) return directValue;

    for (const nestedKey of nestedKeys ?? []) {
      const nestedRecord = asRecord(record?.[nestedKey.containerKey]);
      const nestedValue = pickStringArrayFromRecord(
        nestedRecord,
        nestedKey.keys,
      );
      if (nestedValue?.length) return nestedValue;
    }
  }
  return undefined;
}

function normalizeQueueNonce(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return trimmed;
  return undefined;
}

function parseCooldownQueueNonce(value?: string) {
  const match = value?.match(/cooldown[^\d]*(\d+)/i);
  return normalizeQueueNonce(match?.[1]);
}

function getPolygonQueueNonces({
  position,
  asset,
  extraParams,
}: {
  position: IDeFiPosition | undefined;
  asset: IDeFiAsset;
  extraParams?: IDeFiActionExtraParams;
}) {
  const explicitNonces = pickStringArrayFromSources({
    sources: [extraParams, asset, position],
    directKeys: ['unbondNonces', 'unbond_nonces'],
    nestedKeys: [
      {
        containerKey: 'extraParams',
        keys: ['unbondNonces', 'unbond_nonces'],
      },
      {
        containerKey: 'meta',
        keys: ['unbondNonces', 'unbond_nonces'],
      },
    ],
  })?.map(normalizeQueueNonce);
  const normalizedExplicitNonces = explicitNonces?.filter(
    (item): item is string => Boolean(item),
  );
  if (normalizedExplicitNonces?.length) {
    return normalizedExplicitNonces;
  }

  const explicitNonce = normalizeQueueNonce(
    pickStringFromSources({
      sources: [extraParams, asset, position],
      directKeys: [
        'unbondNonce',
        'unbond_nonce',
        'unbondNonceId',
        'unbond_nonce_id',
      ],
      nestedKeys: [
        {
          containerKey: 'extraParams',
          keys: [
            'unbondNonce',
            'unbond_nonce',
            'unbondNonceId',
            'unbond_nonce_id',
          ],
        },
        {
          containerKey: 'meta',
          keys: [
            'unbondNonce',
            'unbond_nonce',
            'unbondNonceId',
            'unbond_nonce_id',
          ],
        },
      ],
    }),
  );
  if (explicitNonce) return [explicitNonce];

  const assetRecord = asRecord(asset);
  const assetMeta = asRecord(assetRecord?.meta);
  const textSources = [
    position?.name,
    position?.groupId,
    pickStringFromRecord(assetRecord, ['name', 'displayName', 'label']),
    pickStringFromRecord(assetMeta, ['name', 'displayName', 'label']),
    asset.symbol,
  ];

  for (const text of textSources) {
    const nonce = parseCooldownQueueNonce(text);
    if (nonce) return [nonce];
  }

  return undefined;
}

function isPolygonCooldownAsset({
  sourcePosition,
  asset,
}: {
  sourcePosition: IDeFiPosition | undefined;
  asset: IDeFiAsset;
}) {
  if (
    getPolygonQueueNonces({
      position: sourcePosition,
      asset,
      extraParams: mergeExtraParams(sourcePosition?.extraParams, {
        ...asset.extraParams,
      }),
    })?.length
  ) {
    return true;
  }

  return [sourcePosition?.name, sourcePosition?.groupId, asset.symbol].some(
    (text) => /cooldown/i.test(text ?? ''),
  );
}

function mergeExtraParams(
  ...params: (IDeFiActionExtraParams | undefined)[]
): IDeFiActionExtraParams | undefined {
  const merged = params.reduce<IDeFiActionExtraParams>((acc, item) => {
    if (item) {
      Object.assign(acc, item);
    }
    return acc;
  }, {});

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function getPoolAddress(
  position: IDeFiPosition | undefined,
  asset: IDeFiAsset,
) {
  return pickStringFromSources({
    sources: [asset, position],
    directKeys: ['poolAddress', 'pool_address', 'pool'],
    nestedKeys: [
      { containerKey: 'contracts', keys: ['poolAddress', 'pool'] },
      { containerKey: 'extraParams', keys: ['poolAddress', 'pool'] },
      { containerKey: 'meta', keys: ['poolAddress', 'pool_address', 'pool'] },
    ],
  });
}

function getTokenId(position: IDeFiPosition | undefined, asset: IDeFiAsset) {
  const directTokenId = pickStringFromSources({
    sources: [asset, position],
    directKeys: [
      'tokenId',
      'token_id',
      'positionId',
      'position_id',
      'nftId',
      'nft_id',
    ],
    nestedKeys: [
      {
        containerKey: 'extraParams',
        keys: [
          'tokenId',
          'token_id',
          'positionId',
          'position_id',
          'nftId',
          'nft_id',
        ],
      },
      {
        containerKey: 'contracts',
        keys: [
          'tokenId',
          'token_id',
          'positionId',
          'position_id',
          'nftId',
          'nft_id',
        ],
      },
      {
        containerKey: 'meta',
        keys: [
          'tokenId',
          'token_id',
          'positionId',
          'position_id',
          'nftId',
          'nft_id',
        ],
      },
    ],
  });
  return (
    normalizeTokenId(directTokenId) ??
    parsePoolPositionGroupId(position?.groupId)?.tokenId
  );
}

function getCurrency({
  position,
  asset,
  key,
}: {
  position: IDeFiPosition | undefined;
  asset: IDeFiAsset;
  key: 'currency0' | 'currency1';
}) {
  return pickStringFromSources({
    sources: [asset, position],
    directKeys: [key],
    nestedKeys: [
      { containerKey: 'extraParams', keys: [key] },
      { containerKey: 'contracts', keys: [key] },
      { containerKey: 'meta', keys: [key] },
    ],
  });
}

function getUniswapV4SourcePositionCurrencies(
  position: IDeFiPosition | undefined,
) {
  if (!position?.networkId || !position.protocol) return undefined;

  const addresses = position.assets.reduce<string[]>((result, asset) => {
    const address = normalizeEvmAddress(asset.address);
    if (address && isPositiveAmount(asset.amount)) {
      const duplicated = result.some(
        (item) => item.toLowerCase() === address.toLowerCase(),
      );
      if (!duplicated) result.push(address);
    }
    return result;
  }, []);

  addresses.sort((a, b) => {
    const normalizedA = a.toLowerCase();
    const normalizedB = b.toLowerCase();
    if (normalizedA === normalizedB) return 0;
    return normalizedA < normalizedB ? -1 : 1;
  });

  const [currency0, currency1] = addresses;
  if (addresses.length !== 2 || !currency0 || !currency1) return undefined;

  return {
    currency0,
    currency1,
  };
}

function getRemainingUniswapV4Currency(
  knownCurrency: string,
  sourcePositionCurrencies: {
    currency0: string;
    currency1: string;
  },
) {
  const normalizedKnownCurrency = normalizeEvmAddress(knownCurrency);
  if (!normalizedKnownCurrency) return undefined;

  const remainingCurrencies = [
    sourcePositionCurrencies.currency0,
    sourcePositionCurrencies.currency1,
  ].filter(
    (currency) =>
      currency.toLowerCase() !== normalizedKnownCurrency.toLowerCase(),
  );

  return remainingCurrencies.length === 1 ? remainingCurrencies[0] : undefined;
}

function getRemoveLiquidityCurrencies({
  protocolId,
  sourcePosition,
  asset,
}: {
  protocolId: string;
  sourcePosition: IDeFiPosition | undefined;
  asset: IDeFiAsset;
}) {
  const currency0 = getCurrency({
    position: sourcePosition,
    asset,
    key: 'currency0',
  });
  const currency1 = getCurrency({
    position: sourcePosition,
    asset,
    key: 'currency1',
  });

  const isUniswapV4 = isNormalizedProtocolId(protocolId, 'uniswap_v4');
  if (!isUniswapV4) {
    return { currency0, currency1 };
  }

  const sourcePositionCurrencies =
    getUniswapV4SourcePositionCurrencies(sourcePosition);
  if (!sourcePositionCurrencies) {
    return { currency0, currency1 };
  }
  if (currency0 && currency1) {
    return { currency0, currency1 };
  }
  if (currency0) {
    return {
      currency0,
      currency1: getRemainingUniswapV4Currency(
        currency0,
        sourcePositionCurrencies,
      ),
    };
  }
  if (currency1) {
    return {
      currency0: getRemainingUniswapV4Currency(
        currency1,
        sourcePositionCurrencies,
      ),
      currency1,
    };
  }

  return sourcePositionCurrencies;
}

function getSourcePositions(
  position: IDeFiProtocol['positions'][number],
): IDeFiPosition[] {
  return position.sourcePositions?.length
    ? position.sourcePositions
    : [
        {
          networkId: '',
          owner: '',
          protocol: '',
          protocolName: '',
          chain: '',
          category: position.category,
          assets: position.assets,
          debts: position.debts,
          rewards: position.rewards,
          metrics: { healthFactor: null },
          source: {
            provider: '',
            fetchedAt: '',
            ttl: 0,
            cached: false,
          },
          groupId: position.groupId,
          name: position.poolFullName,
        },
      ];
}

function getSupportedAssetCategory(
  supportedAction: IDeFiSupportedProtocolAction,
) {
  if (supportedAction.action === EDeFiPositionAction.Claim) {
    return supportedAction.rewardCategory ?? supportedAction.assetCategory;
  }
  return supportedAction.assetCategory;
}

function getCandidateAssets({
  position,
  supportedAction,
}: {
  position: IDeFiProtocol['positions'][number];
  supportedAction: IDeFiSupportedProtocolAction;
}): { asset: IDeFiAsset; sourcePosition: IDeFiPosition | undefined }[] {
  const targetCategory = getSupportedAssetCategory(supportedAction);
  const sourcePositions = getSourcePositions(position);

  return sourcePositions.flatMap((sourcePosition) => {
    const candidates =
      supportedAction.action === EDeFiPositionAction.Claim
        ? sourcePosition.rewards
        : sourcePosition.assets;
    const positiveCandidates = candidates.filter((asset) =>
      isPositiveAmount(asset.amount),
    );

    if (supportedAction.action === EDeFiPositionAction.RemoveLiquidity) {
      const asset =
        positiveCandidates.find((candidate) =>
          Boolean(getTokenId(sourcePosition, candidate)),
        ) ?? positiveCandidates[0];
      return asset ? [{ asset, sourcePosition }] : [];
    }

    return positiveCandidates
      .filter((asset) => {
        if (
          isNormalizedProtocolId(supportedAction.protocolId, 'polygon_staking')
        ) {
          const isCooldownAsset = isPolygonCooldownAsset({
            sourcePosition,
            asset,
          });
          if (supportedAction.action === EDeFiPositionAction.ClaimWithdrawal) {
            return isCooldownAsset;
          }
          if (
            supportedAction.action === EDeFiPositionAction.Withdraw &&
            isCooldownAsset
          ) {
            return false;
          }
        }

        return isCategoryMatch(targetCategory, asset.category);
      })
      .map((asset) => ({ asset, sourcePosition }));
  });
}

function buildResolvedAsset({
  protocolId,
  action,
  asset,
  sourcePosition,
}: {
  protocolId: string;
  action: EDeFiPositionAction;
  asset: IDeFiAsset;
  sourcePosition: IDeFiPosition | undefined;
}): IResolvedDeFiPositionActionAsset | undefined {
  let extraParams = mergeExtraParams(sourcePosition?.extraParams, {
    ...asset.extraParams,
  });
  const poolAddress = getPoolAddress(sourcePosition, asset);

  if (action === EDeFiPositionAction.RemoveLiquidity) {
    const tokenId = getTokenId(sourcePosition, asset);
    if (!tokenId) return undefined;

    const { currency0, currency1 } = getRemoveLiquidityCurrencies({
      protocolId,
      sourcePosition,
      asset,
    });

    if (
      isNormalizedProtocolId(protocolId, 'uniswap_v4') &&
      (!currency0 || !currency1)
    ) {
      return undefined;
    }

    return {
      asset,
      amount: asset.amount,
      symbol: asset.symbol,
      tokenAddress: asset.address,
      extraParams: {
        ...extraParams,
        ...(tokenId ? { tokenId } : {}),
        ...(currency0 ? { currency0 } : {}),
        ...(currency1 ? { currency1 } : {}),
      },
    };
  }

  if (isPoolAddressRequired({ protocolId, action }) && !poolAddress) {
    return undefined;
  }

  if (
    isNormalizedProtocolId(protocolId, 'polygon_staking') &&
    action === EDeFiPositionAction.ClaimWithdrawal
  ) {
    const queueNonces = getPolygonQueueNonces({
      position: sourcePosition,
      asset,
      extraParams,
    });
    if (!queueNonces?.length) {
      return undefined;
    }
    // oxlint-disable-next-line @cspell/spellchecker
    extraParams = mergeExtraParams(extraParams, { unbondNonces: queueNonces });
  }

  return {
    asset,
    amount: asset.amount,
    symbol: asset.symbol,
    tokenAddress: asset.address,
    extraParams: {
      ...extraParams,
      ...(poolAddress ? { poolAddress } : {}),
    },
  };
}

function resolveDeFiPositionActions({
  protocol,
  position,
  supportedActions,
}: IResolveDeFiPositionActionsParams): IResolvedDeFiPositionAction[] {
  const matchedActions = supportedActions.filter(
    (supportedAction) =>
      isProtocolMatch(supportedAction.protocolId, protocol.protocol) &&
      supportedAction.networkId === protocol.networkId &&
      supportedAction.action !== EDeFiPositionAction.Permit &&
      isCategoryMatch(supportedAction.positionCategory, position.category),
  );

  return matchedActions.reduce<IResolvedDeFiPositionAction[]>(
    (acc, supportedAction) => {
      const resolvedAssets = getCandidateAssets({
        position,
        supportedAction,
      }).map(({ asset, sourcePosition }) =>
        buildResolvedAsset({
          protocolId: supportedAction.protocolId,
          action: supportedAction.action,
          asset,
          sourcePosition,
        }),
      );
      const assets = resolvedAssets.filter(
        (asset): asset is IResolvedDeFiPositionActionAsset => Boolean(asset),
      );

      if (assets.length === 0) {
        return acc;
      }

      acc.push({
        action: supportedAction.action,
        protocolId: supportedAction.protocolId,
        networkId: supportedAction.networkId,
        positionCategory: supportedAction.positionCategory,
        assetCategory: supportedAction.assetCategory,
        rewardCategory: supportedAction.rewardCategory,
        assets,
      });
      return acc;
    },
    [],
  );
}

export default {
  resolveDeFiPositionActions,
};

export { resolveDeFiPositionActions };
