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

type IMatchSupportedDeFiPositionActionsParams =
  IResolveDeFiPositionActionsParams;

type IDeFiPositionActionKeySource = Pick<
  IResolvedDeFiPositionAction,
  | 'protocolId'
  | 'networkId'
  | 'positionCategory'
  | 'assetCategory'
  | 'debtCategory'
  | 'rewardCategory'
  | 'action'
>;

const DEFI_ACTION_MIN_PERCENT = 1;
const DEFI_ACTION_MAX_PERCENT = 100;
const DEFI_ACTION_BPS_PER_PERCENT = 100;

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
  // Temporary compatibility with the remote Earn branch typo. Remove after the
  // service contract has been deployed with the corrected category.
  // oxlint-disable-next-line @cspell/spellchecker
  deopsit: 'deposit',
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

function getDeFiPositionActionKey(action: IDeFiPositionActionKeySource) {
  return [
    action.protocolId,
    action.networkId,
    action.positionCategory,
    action.assetCategory ?? '',
    action.debtCategory ?? '',
    action.rewardCategory ?? '',
    action.action,
  ].join('-');
}

function normalizeDeFiActionPercent(value?: number) {
  const percent = value ?? DEFI_ACTION_MAX_PERCENT;
  if (!Number.isFinite(percent)) return undefined;
  const normalizedValue = Math.round(percent);
  if (
    normalizedValue < DEFI_ACTION_MIN_PERCENT ||
    normalizedValue > DEFI_ACTION_MAX_PERCENT
  ) {
    return undefined;
  }
  return normalizedValue;
}

function buildDeFiActionBps(percent?: number) {
  const normalizedPercent = normalizeDeFiActionPercent(percent);
  if (normalizedPercent === undefined) return undefined;
  return String(normalizedPercent * DEFI_ACTION_BPS_PER_PERCENT);
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
  const normalizedProtocolId = normalizeProtocolForAction(protocolId);

  if (action === EDeFiPositionAction.Withdraw) {
    return [
      'aave_pool_v3',
      'morpho_blue',
      'polygon_staking',
      'ethena',
      'spark',
      'fluid',
      'sky',
      'maple',
      'stake_dao',
    ].includes(normalizedProtocolId);
  }

  if (action === EDeFiPositionAction.Claim) {
    return ['polygon_staking', 'stake_dao'].includes(normalizedProtocolId);
  }

  if (action === EDeFiPositionAction.ClaimWithdrawal) {
    return ['polygon_staking', 'ethena'].includes(normalizedProtocolId);
  }

  if (action === EDeFiPositionAction.Repay) {
    return ['aave_pool_v3'].includes(normalizedProtocolId);
  }

  return false;
}

function isPositiveAmount(amount?: string) {
  if (!amount) return false;
  const value = new BigNumber(amount);
  return value.isFinite() && value.gt(0);
}

// Whether the position currently holds claimable rewards (a positive reward
// balance on the position itself or any of its source positions). Drives the
// "Remove" vs "Remove & Claim rewards" labelling: removing an LP that has
// rewards also claims them, so the label says so only when rewards exist.
function positionHasRewards(
  position: IDeFiProtocol['positions'][number],
): boolean {
  const hasPositiveReward = (rewards: IDeFiAsset[] | undefined) =>
    rewards?.some((reward) => isPositiveAmount(reward.amount)) ?? false;
  return (
    hasPositiveReward(position.rewards) ||
    (position.sourcePositions?.some((sourcePosition) =>
      hasPositiveReward(sourcePosition.rewards),
    ) ??
      false)
  );
}

function asRecord(value: unknown): IDeFiUnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as IDeFiUnknownRecord;
}

function hasProxyDetail(value: unknown) {
  const record = asRecord(value);
  const extraParams = asRecord(record?.extraParams);
  return Boolean(
    asRecord(record?.proxyDetail) ||
    asRecord(record?.proxy_detail) ||
    asRecord(extraParams?.proxyDetail) ||
    asRecord(extraParams?.proxy_detail),
  );
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

function isPolygonStakedPosition(position?: IDeFiPosition) {
  return position?.groupId?.trim().toLowerCase().endsWith('#staked') ?? false;
}

function isPolygonClaimableWithdrawalPosition(position?: IDeFiPosition) {
  // The groupId itself is enough for the build API to identify claimable
  // withdrawals. Do not parse or submit nonce arrays on the client.
  // oxlint-disable-next-line @cspell/spellchecker
  return /#new_version_unbonded_\d+$/i.test(position?.groupId?.trim() ?? '');
}

function getPoolAddressFromGroupId(groupId?: string) {
  const [poolAddress] = groupId?.trim().split('#') ?? [];
  return normalizeEvmAddress(poolAddress);
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

function omitClientOnlyExtraParams(params?: IDeFiActionExtraParams) {
  if (!params) return undefined;

  const result: IDeFiActionExtraParams = { ...params };
  // Polygon claimWithdrawal is identified by groupId on the service side.
  // oxlint-disable-next-line @cspell/spellchecker
  delete result.unbondNonces;
  // oxlint-disable-next-line @cspell/spellchecker
  delete result.unbond_nonces;

  return Object.keys(result).length > 0 ? result : undefined;
}

function getPoolAddress({
  protocolId,
  position,
  asset,
}: {
  protocolId: string;
  position: IDeFiPosition | undefined;
  asset: IDeFiAsset;
}) {
  const explicitPoolAddress = pickStringFromSources({
    sources: [asset, position],
    directKeys: ['poolAddress', 'pool_address', 'pool'],
    nestedKeys: [
      { containerKey: 'contracts', keys: ['poolAddress', 'pool'] },
      { containerKey: 'extraParams', keys: ['poolAddress', 'pool'] },
      { containerKey: 'meta', keys: ['poolAddress', 'pool_address', 'pool'] },
    ],
  });
  if (explicitPoolAddress) return explicitPoolAddress;

  if (isNormalizedProtocolId(protocolId, 'polygon_staking')) {
    return getPoolAddressFromGroupId(position?.groupId);
  }

  return undefined;
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
          proxyDetail: position.proxyDetail,
        },
      ];
}

function getSupportedAssetCategory(
  supportedAction: IDeFiSupportedProtocolAction,
) {
  if (supportedAction.action === EDeFiPositionAction.Claim) {
    return supportedAction.rewardCategory ?? supportedAction.assetCategory;
  }
  if (supportedAction.action === EDeFiPositionAction.Repay) {
    return supportedAction.debtCategory ?? supportedAction.assetCategory;
  }
  return supportedAction.assetCategory;
}

function getCandidateAssetList({
  sourcePosition,
  supportedAction,
}: {
  sourcePosition: IDeFiPosition;
  supportedAction: IDeFiSupportedProtocolAction;
}) {
  if (supportedAction.action === EDeFiPositionAction.Claim) {
    return sourcePosition.rewards;
  }
  if (supportedAction.action === EDeFiPositionAction.Repay) {
    return sourcePosition.debts;
  }
  return sourcePosition.assets;
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
    if (hasProxyDetail(sourcePosition)) {
      return [];
    }

    const candidates = getCandidateAssetList({
      sourcePosition,
      supportedAction,
    });
    const positiveCandidates = candidates.filter(
      (asset) => isPositiveAmount(asset.amount) && !hasProxyDetail(asset),
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
          if (supportedAction.action === EDeFiPositionAction.ClaimWithdrawal) {
            return isPolygonClaimableWithdrawalPosition(sourcePosition);
          }
          if (supportedAction.action === EDeFiPositionAction.Withdraw) {
            return (
              isPolygonStakedPosition(sourcePosition) &&
              isCategoryMatch(targetCategory, asset.category)
            );
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
  const groupId = sourcePosition?.groupId?.trim();
  if (
    groupId?.includes('#') &&
    isNormalizedProtocolId(protocolId, 'aave_pool_v3')
  ) {
    return undefined;
  }
  if (groupId) {
    extraParams = mergeExtraParams(extraParams, { groupId });
  }
  extraParams = omitClientOnlyExtraParams(extraParams);
  const poolAddress = getPoolAddress({
    protocolId,
    position: sourcePosition,
    asset,
  });

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
      underlyingAssets: sourcePosition?.assets.filter((item) =>
        isPositiveAmount(item.amount),
      ),
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

function getMatchedSupportedDeFiPositionActions({
  protocol,
  position,
  supportedActions,
}: IMatchSupportedDeFiPositionActionsParams) {
  return supportedActions.filter(
    (supportedAction) =>
      isProtocolMatch(supportedAction.protocolId, protocol.protocol) &&
      supportedAction.networkId === protocol.networkId &&
      supportedAction.action !== EDeFiPositionAction.Permit &&
      isCategoryMatch(supportedAction.positionCategory, position.category),
  );
}

function buildResolvedDeFiPositionAction({
  supportedAction,
  assets,
}: {
  supportedAction: IDeFiSupportedProtocolAction;
  assets: IResolvedDeFiPositionActionAsset[];
}): IResolvedDeFiPositionAction {
  return {
    action: supportedAction.action,
    protocolId: supportedAction.protocolId,
    networkId: supportedAction.networkId,
    positionCategory: supportedAction.positionCategory,
    assetCategory: supportedAction.assetCategory,
    debtCategory: supportedAction.debtCategory,
    rewardCategory: supportedAction.rewardCategory,
    assets,
  };
}

function resolveDeFiPositionActions({
  protocol,
  position,
  supportedActions,
}: IResolveDeFiPositionActionsParams): IResolvedDeFiPositionAction[] {
  const matchedActions = getMatchedSupportedDeFiPositionActions({
    protocol,
    position,
    supportedActions,
  });

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

      acc.push(
        buildResolvedDeFiPositionAction({
          supportedAction,
          assets,
        }),
      );
      return acc;
    },
    [],
  );
}

function resolveDeFiPositionActionDebugCandidates({
  protocol,
  position,
  supportedActions,
}: IResolveDeFiPositionActionsParams): IResolvedDeFiPositionAction[] {
  const resolvedActionKeys = new Set(
    resolveDeFiPositionActions({
      protocol,
      position,
      supportedActions,
    }).map(getDeFiPositionActionKey),
  );

  return getMatchedSupportedDeFiPositionActions({
    protocol,
    position,
    supportedActions,
  }).reduce<IResolvedDeFiPositionAction[]>((acc, supportedAction) => {
    if (resolvedActionKeys.has(getDeFiPositionActionKey(supportedAction))) {
      return acc;
    }

    acc.push(
      buildResolvedDeFiPositionAction({
        supportedAction,
        assets: [],
      }),
    );
    return acc;
  }, []);
}

// Narrow a resolved position action down to a single token (matched by token
// address, case-insensitive). Returns undefined when the action doesn't touch
// that token. Lets a per-asset caller give every supplied/borrowed row its own
// button instead of one position-level button with a multi-select dialog.
function scopeResolvedActionToAsset<T extends IResolvedDeFiPositionAction>({
  action,
  tokenAddress,
}: {
  action: T;
  tokenAddress: string | undefined;
}): T | undefined {
  const target = tokenAddress?.trim().toLowerCase();
  if (!target) return undefined;
  const assets = action.assets.filter((item) => {
    const address = (item.tokenAddress ?? item.asset.address)
      ?.trim()
      .toLowerCase();
    return address === target;
  });
  if (assets.length === 0) return undefined;
  return { ...action, assets };
}

// Resolve the amount/bps a build-transaction call should send for a
// percentage-capable action. Manual partial entry sends the exact token amount
// (human-decimal, matching IDeFiAsset.amount); a full close (Max) or the slider
// sends bps — Max forces 100% so a balance that accrues between render and
// submit can't leave dust. Non-percentage actions (claim) send neither.
export function resolveDeFiActionTxAmount({
  percentageAction,
  percent,
  amount,
  isMaxAmount,
}: {
  percentageAction: boolean;
  percent?: number;
  amount?: string;
  isMaxAmount?: boolean;
}): { amount?: string; bps?: string } {
  if (!percentageAction) return {};
  const trimmedAmount = amount?.trim();
  const amountBN = trimmedAmount ? new BigNumber(trimmedAmount) : undefined;
  if (!isMaxAmount && amountBN?.isFinite() && amountBN.gt(0)) {
    return { amount: trimmedAmount };
  }
  return {
    bps: buildDeFiActionBps(isMaxAmount ? DEFI_ACTION_MAX_PERCENT : percent),
  };
}

export default {
  buildDeFiActionBps,
  positionHasRewards,
  resolveDeFiActionTxAmount,
  resolveDeFiPositionActionDebugCandidates,
  resolveDeFiPositionActions,
  scopeResolvedActionToAsset,
};

export {
  DEFI_ACTION_MAX_PERCENT,
  DEFI_ACTION_MIN_PERCENT,
  buildDeFiActionBps,
  normalizeCategoryForAction,
  normalizeDeFiActionPercent,
  positionHasRewards,
  resolveDeFiPositionActionDebugCandidates,
  resolveDeFiPositionActions,
  scopeResolvedActionToAsset,
};
