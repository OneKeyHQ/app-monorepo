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

function normalizeTokenId(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed) || /^0x[0-9a-f]+$/i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(
    /(?:tokenId|token_id|positionId|position_id|nftId|nft_id)[:=_-](\d+)/i,
  );
  return match?.[1];
}

function getUniqueAssetAddresses(position: IDeFiPosition | undefined) {
  const addresses: string[] = [];
  for (const asset of position?.assets ?? []) {
    const address = asset.address?.trim();
    if (address && !addresses.includes(address)) {
      addresses.push(address);
    }
  }
  return addresses;
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
  return normalizeTokenId(directTokenId) ?? normalizeTokenId(position?.groupId);
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

    return candidates
      .filter((asset) => isPositiveAmount(asset.amount))
      .filter((asset) => isCategoryMatch(targetCategory, asset.category))
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
  const extraParams = mergeExtraParams(sourcePosition?.extraParams, {
    ...asset.extraParams,
  });
  const poolAddress = getPoolAddress(sourcePosition, asset);

  if (action === EDeFiPositionAction.RemoveLiquidity) {
    const tokenId = getTokenId(sourcePosition, asset);
    if (!tokenId) return undefined;

    const assetAddresses = getUniqueAssetAddresses(sourcePosition);
    const currency0 =
      getCurrency({
        position: sourcePosition,
        asset,
        key: 'currency0',
      }) ?? assetAddresses[0];
    const currency1 =
      getCurrency({
        position: sourcePosition,
        asset,
        key: 'currency1',
      }) ?? assetAddresses.find((address) => address !== currency0);

    if (protocolId === 'uniswap-v4' && (!currency0 || !currency1)) {
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
