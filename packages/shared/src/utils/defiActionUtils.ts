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
  liquidity: 'liquidity',
  liquidity_pool: 'liquidity',
  lp: 'liquidity',
  lending: 'lending',
  yield: 'yield',
};

function normalizeCategoryForAction(value?: string) {
  const normalized = normalizeMatchValue(value);
  return CATEGORY_ALIAS_MAP[normalized] ?? normalized;
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
  return pickStringFromSources({
    sources: [asset, position],
    directKeys: ['tokenId', 'token_id'],
    nestedKeys: [
      { containerKey: 'extraParams', keys: ['tokenId', 'token_id'] },
      { containerKey: 'contracts', keys: ['tokenId', 'token_id'] },
      { containerKey: 'meta', keys: ['tokenId', 'token_id'] },
    ],
  });
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
  action,
  asset,
  sourcePosition,
}: {
  action: EDeFiPositionAction;
  asset: IDeFiAsset;
  sourcePosition: IDeFiPosition | undefined;
}): IResolvedDeFiPositionActionAsset {
  const extraParams = mergeExtraParams(sourcePosition?.extraParams, {
    ...asset.extraParams,
  });
  const poolAddress = getPoolAddress(sourcePosition, asset);

  if (action === EDeFiPositionAction.RemoveLiquidity) {
    const tokenId = getTokenId(sourcePosition, asset);

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
      supportedAction.protocolId === protocol.protocol &&
      supportedAction.networkId === protocol.networkId &&
      supportedAction.action !== EDeFiPositionAction.Permit &&
      isCategoryMatch(supportedAction.positionCategory, position.category),
  );

  return matchedActions.reduce<IResolvedDeFiPositionAction[]>(
    (acc, supportedAction) => {
      const assets = getCandidateAssets({ position, supportedAction }).map(
        ({ asset, sourcePosition }) =>
          buildResolvedAsset({
            action: supportedAction.action,
            asset,
            sourcePosition,
          }),
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
