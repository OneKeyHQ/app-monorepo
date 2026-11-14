import BigNumber from 'bignumber.js';
import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { applySharedBalanceExclusionToTokenGroups } from '@onekeyhq/shared/src/utils/sharedBalanceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import { sumTokenGroupsFiatValueIgnoringUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { DUST_SWEEP_PROVIDER } from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchAccountTokensResp,
  IToken,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import { buildDustSweepCandidates } from './candidates';
import { getDustSweepNetworksCacheRevision } from './networkCache';

export function getDustSweepSupportedNetworks(networks: ISwapNetwork[]) {
  return networks.filter((network) => network.supportSingleSwap);
}

async function loadQuietly<T>(load: () => Promise<T>) {
  try {
    return await load();
  } catch (error) {
    // The background proxy defers auto-toast dispatch so optional UI queries
    // can suppress it at the caller, without changing explicit page requests.
    errorToastUtils.toastIfErrorDisable(error);
    throw error;
  }
}

async function loadAssetQuietly<T>(load: () => Promise<T>) {
  try {
    return await loadQuietly(load);
  } catch (error) {
    // Only read-only asset queries may retry the onchain dependency error.
    // Never retry validation failures or transaction submission here.
    if (
      !isTransientNetworkLikeError(error) &&
      (error as { code?: number } | undefined)?.code !== 40_001
    )
      throw error;
    await timerUtils.wait(300);
    return loadQuietly(load);
  }
}

export async function loadDustSweepEntryCapabilities(
  fetchNetworks: () => Promise<ISwapNetwork[]> = () =>
    backgroundApiProxy.serviceSwap.fetchSwapNetworks({
      autoHandleError: false,
    }),
) {
  return getDustSweepSupportedNetworks(await loadQuietly(fetchNetworks));
}

export type IDustSweepNetworksResult = {
  networks: IDustSweepNetwork[];
  partialError: boolean;
  providerInfo?: ISwapProviderInfo;
  failedNetworkIds?: string[];
  failedNetworkOwners?: {
    networkId: string;
    accountId: string;
    address: string;
  }[];
  failedNetworks?: ISwapNetwork[];
};

type IDustSweepNetworkLoad = {
  fresh: Promise<IDustSweepNetworksResult>;
  contexts: Promise<IDustSweepNetworkContexts>;
};

const inFlightLoads = new Map<string, IDustSweepNetworkLoad>();

function getLoadKey(params: IDustSweepRouteParams) {
  return JSON.stringify([
    params.walletId,
    params.accountId ?? '',
    params.indexedAccountId ?? '',
    params.networkId ?? '',
    getDustSweepNetworksCacheRevision(params.walletId),
  ]);
}

function createCancellationError() {
  return new OneKeyLocalError('Dust Sweep cancelled');
}

function waitForLoad<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(createCancellationError());
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let onAbort = () => undefined;
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };
    onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createCancellationError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

export type IDustSweepNetworkContext = Omit<
  IDustSweepNetwork,
  'tokens' | 'nativeToken' | 'balanceUsd'
>;

type IDustSweepWalletResponse = Pick<
  IFetchAccountTokensResp,
  'tokens' | 'smallBalanceTokens' | 'riskTokens'
>;

function assertUsdPricing(response: IDustSweepWalletResponse) {
  if (
    [response.tokens, response.smallBalanceTokens, response.riskTokens].some(
      (group) => group.currency && group.currency !== 'usd',
    )
  ) {
    throw new OneKeyLocalError('USD pricing is unavailable');
  }
}

function mergeSupplementalWalletTokens({
  initial,
  supplemental,
  networkId,
  missingContracts,
}: {
  initial: IDustSweepWalletResponse;
  supplemental: IDustSweepWalletResponse;
  networkId: string;
  missingContracts: string[];
}): IDustSweepWalletResponse {
  assertUsdPricing(initial);
  assertUsdPricing(supplemental);
  const groupNames = ['riskTokens', 'smallBalanceTokens', 'tokens'] as const;
  const copyGroup = (group: ITokenData): ITokenData => ({
    ...group,
    data: [...group.data],
    map: Object.fromEntries(
      Object.entries(group.map).map(([key, value]) => [key, { ...value }]),
    ),
  });
  const merged = {
    tokens: copyGroup(initial.tokens),
    smallBalanceTokens: copyGroup(initial.smallBalanceTokens),
    riskTokens: copyGroup(initial.riskTokens),
  };
  const normalize = (contractAddress: string) =>
    normalizeTokenContractAddress({ networkId, contractAddress });
  const requested = new Set(missingContracts.map(normalize));
  const seenAddresses = new Set(
    groupNames.flatMap((name) =>
      initial[name].data.map((token) => normalize(token.address)),
    ),
  );
  const seenKeys = new Set(
    groupNames.flatMap((name) => [
      ...initial[name].data.map((token) => token.$key),
      ...Object.keys(initial[name].map),
    ]),
  );

  // The supplemental query may return the entire wallet list. Only append the
  // requested missing assets, preserving the original groups and totals.
  for (const name of groupNames) {
    supplemental[name].data.forEach((token) => {
      const address = normalize(token.address);
      const value = supplemental[name].map[token.$key];
      if (
        !address ||
        token.isNative ||
        (token.networkId && token.networkId !== networkId) ||
        !requested.has(address) ||
        seenAddresses.has(address) ||
        !value
      )
        return;
      if (seenKeys.has(token.$key)) {
        throw new OneKeyLocalError('Conflicting token metadata');
      }
      seenAddresses.add(address);
      seenKeys.add(token.$key);
      merged[name].data.push(token);
      merged[name].map[token.$key] = { ...value };
    });
    merged[name].keys = merged[name].data.map((token) => token.$key).join(',');
  }
  applySharedBalanceExclusionToTokenGroups(merged);
  return merged;
}

async function loadDustSweepNetworkAssets({
  entry,
  indexedAccountId,
  isManualRefresh,
}: {
  entry: IDustSweepNetworkContext;
  indexedAccountId?: string;
  isManualRefresh: boolean;
}): Promise<IDustSweepNetwork> {
  const [walletResponse, native, swapTokens] = await Promise.all([
    loadAssetQuietly(() =>
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        accountId: entry.accountId,
        networkId: entry.network.networkId,
        indexedAccountId: indexedAccountId,
        flag: 'dust-sweep',
        hideSmallBalanceTokens: false,
        hideRiskTokens: false,
        excludeDeFiMarkedTokens: true,
        withoutDappToken: true,
        saveToLocal: false,
        isManualRefresh,
      }),
    ),
    loadAssetQuietly(() =>
      backgroundApiProxy.serviceToken.getNativeToken({
        accountId: entry.accountId,
        networkId: entry.network.networkId,
      }),
    ),
    loadAssetQuietly(() =>
      backgroundApiProxy.serviceSwap.fetchSwapTokens({
        accountId: entry.accountId,
        accountAddress: entry.address,
        accountNetworkId: entry.network.networkId,
        networkId: entry.network.networkId,
        currency: 'usd',
        throwOnError: true,
        isTokenListPrefetch: true,
      }),
    ),
  ]);
  const knownAddresses = new Set(
    [
      ...walletResponse.tokens.data,
      ...walletResponse.smallBalanceTokens.data,
      ...walletResponse.riskTokens.data,
    ].map((token) =>
      normalizeTokenContractAddress({
        networkId: entry.network.networkId,
        contractAddress: token.address,
      }),
    ),
  );
  const missingContracts = swapTokens.flatMap((token) => {
    const address = normalizeTokenContractAddress({
      networkId: entry.network.networkId,
      contractAddress: token.contractAddress,
    });
    const balance = new BigNumber(token.balanceParsed ?? '');
    if (
      token.networkId !== entry.network.networkId ||
      token.isNative ||
      !address ||
      knownAddresses.has(address) ||
      !balance.isFinite() ||
      !balance.gt(0)
    )
      return [];
    knownAddresses.add(address);
    return [token.contractAddress];
  });
  const response = missingContracts.length
    ? mergeSupplementalWalletTokens({
        initial: walletResponse,
        supplemental: await loadAssetQuietly(() =>
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: entry.accountId,
            networkId: entry.network.networkId,
            indexedAccountId,
            flag: 'dust-sweep',
            hideSmallBalanceTokens: false,
            hideRiskTokens: false,
            excludeDeFiMarkedTokens: true,
            withoutDappToken: true,
            saveToLocal: false,
            isManualRefresh,
            contractList: missingContracts,
          }),
        ),
        networkId: entry.network.networkId,
        missingContracts,
      })
    : walletResponse;
  return buildDustSweepNetwork(entry, response, native, swapTokens);
}

function buildDustSweepNetwork(
  entry: IDustSweepNetworkContext,
  response: IDustSweepWalletResponse,
  native: IToken | null | undefined,
  swapTokens: ISwapToken[],
): IDustSweepNetwork {
  if (!native) throw new OneKeyLocalError('Native token is unavailable');
  assertUsdPricing(response);
  const tokens = buildDustSweepCandidates(
    response,
    entry.network.networkId,
    swapTokens,
  );
  const nativeEntry = [
    ...response.tokens.data,
    ...response.smallBalanceTokens.data,
  ].find((token) => token.isNative);
  const nativeFiat = nativeEntry
    ? (response.tokens.map[nativeEntry.$key] ??
      response.smallBalanceTokens.map[nativeEntry.$key])
    : undefined;
  return {
    ...entry,
    tokens,
    nativeToken: {
      networkId: entry.network.networkId,
      contractAddress: native.address,
      isNative: true,
      symbol: native.symbol,
      name: native.name,
      decimals: native.decimals,
      logoURI: native.logoURI,
      price: nativeFiat?.price?.toString(),
      balanceParsed: nativeFiat?.balanceParsed,
    },
    // Same rule as the Home network value: regular + small-balance tokens.
    balanceUsd: sumTokenGroupsFiatValueIgnoringUnavailable(response),
  };
}

export function refreshDustSweepNetwork(
  params: { entry: IDustSweepNetwork; indexedAccountId?: string },
  signal: AbortSignal,
) {
  if (signal.aborted) return Promise.reject(createCancellationError());
  // A post-transaction read must never adopt a pre-transaction in-flight load.
  return waitForLoad(
    loadDustSweepNetworkAssets({ ...params, isManualRefresh: true }),
    signal,
  );
}

async function loadDustSweepNetworkContexts(params: IDustSweepRouteParams) {
  const { accountId } = params;
  if (
    !accountId ||
    accountUtils.isWatchingAccount({ accountId }) ||
    accountUtils.isExternalAccount({ accountId })
  )
    throw new OneKeyLocalError('Account is unavailable');
  const [networks, { accountsInfo }, providers] = await Promise.all([
    loadQuietly(() =>
      backgroundApiProxy.serviceSwap.fetchSwapNetworks({
        autoHandleError: false,
      }),
    ),
    loadQuietly(() =>
      backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        indexedAccountId: params.indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        // A single-network entry must resolve that network even when the user
        // disabled it in the All Networks aggregate view.
        networksEnabledOnly: !params.networkId,
        excludeTestNetwork: true,
        includingNonExistingAccount: false,
        includingNotEqualGlobalDeriveTypeAccount: Boolean(params.networkId),
      }),
    ),
    loadQuietly(() => backgroundApiProxy.serviceSwap.getSwapProviderManager()),
  ]);
  const provider = providers.find(
    (item) => item.providerInfo.provider === DUST_SWEEP_PROVIDER,
  );
  const supportedNetworks = getDustSweepSupportedNetworks(networks);
  const isRequestedNetworkUnsupported = Boolean(
    params.networkId &&
    !supportedNetworks.some(
      (network) => network.networkId === params.networkId,
    ),
  );
  const candidates = supportedNetworks.filter(
    (network) =>
      (!params.networkId || network.networkId === params.networkId) &&
      accountsInfo.some(
        (account) =>
          account.networkId === network.networkId &&
          (!params.networkId || account.accountId === params.accountId),
      ),
  );
  const entries = candidates.flatMap((network): IDustSweepNetworkContext[] => {
    const account = accountsInfo.find(
      (item) =>
        item.networkId === network.networkId &&
        (!params.networkId || item.accountId === params.accountId),
    );
    return account
      ? [
          {
            network,
            accountId: account.accountId,
            address: account.apiAddress,
            deriveAddressEncoding: account.deriveInfo?.addressEncoding,
          },
        ]
      : [];
  });
  return {
    entries,
    providerInfo: provider?.providerInfo,
    isRequestedNetworkUnsupported,
  };
}

type IDustSweepNetworkContexts = Awaited<
  ReturnType<typeof loadDustSweepNetworkContexts>
>;

export function validateDustSweepNetworkContexts(
  params: IDustSweepRouteParams,
  signal: AbortSignal,
) {
  if (signal.aborted) return Promise.reject(createCancellationError());
  return waitForLoad(loadDustSweepNetworkContexts(params), signal).then(
    ({ entries }) => entries,
  );
}

async function loadDustSweepNetworksInternal(
  params: IDustSweepRouteParams,
  contexts: Promise<IDustSweepNetworkContexts>,
  isManualRefresh: boolean,
): Promise<IDustSweepNetworksResult> {
  const { entries, providerInfo, isRequestedNetworkUnsupported } =
    await contexts;
  const limit = pLimit(4);
  const results = await Promise.allSettled(
    entries.map((entry) =>
      limit(() =>
        loadDustSweepNetworkAssets({
          entry,
          indexedAccountId: params.indexedAccountId,
          isManualRefresh,
        }),
      ),
    ),
  );
  const data = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
  if (
    !data.length &&
    (results.some((result) => result.status === 'rejected') ||
      (params.networkId && !isRequestedNetworkUnsupported))
  )
    throw new OneKeyLocalError(
      params.networkId
        ? 'Selected network account is unavailable'
        : 'Unable to load balances',
    );
  return {
    networks: data,
    partialError: results.some((result) => result.status === 'rejected'),
    providerInfo,
    ...(results.some((result) => result.status === 'rejected')
      ? {
          failedNetworkIds: entries
            .filter((_, index) => results[index].status === 'rejected')
            .map((entry) => entry.network.networkId),
          failedNetworkOwners: entries
            .filter((_, index) => results[index].status === 'rejected')
            .map((entry) => ({
              networkId: entry.network.networkId,
              accountId: entry.accountId,
              address: entry.address,
            })),
          failedNetworks: entries
            .filter((_, index) => results[index].status === 'rejected')
            .map((entry) => entry.network),
        }
      : {}),
  };
}

export function loadDustSweepNetworks(
  params: IDustSweepRouteParams,
  signal: AbortSignal,
  {
    isManualRefresh = false,
    forceFresh = false,
    onContexts,
  }: {
    isManualRefresh?: boolean;
    forceFresh?: boolean;
    onContexts?: (entries: IDustSweepNetworkContext[]) => void;
  } = {},
) {
  const key = getLoadKey(params);
  // A return from Swap must not reuse a request started before the trade.
  let load = isManualRefresh || forceFresh ? undefined : inFlightLoads.get(key);
  if (!load) {
    // Discovery and the network round are shared across quick re-entry.
    const contexts = loadDustSweepNetworkContexts(params);
    load = {
      contexts,
      fresh: loadDustSweepNetworksInternal(params, contexts, isManualRefresh),
    };
    inFlightLoads.set(key, load);
    const cleanup = () => {
      if (inFlightLoads.get(key) === load) inFlightLoads.delete(key);
    };
    void load.fresh.then(cleanup, cleanup);
  }
  let settled = false;
  void load.contexts.then(
    ({ entries }) => {
      if (!settled && !signal.aborted) onContexts?.(entries);
    },
    () => undefined,
  );
  return waitForLoad(load.fresh, signal).finally(() => {
    settled = true;
  });
}
