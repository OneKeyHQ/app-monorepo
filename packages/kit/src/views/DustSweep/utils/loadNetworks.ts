import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  buildUnifiedSwapProviderManagers,
  getDenySwapProviderString,
} from '@onekeyhq/shared/src/utils/swapProviderManagerUtils';
import { sumTokenGroupsFiatValueIgnoringUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { DUST_SWEEP_PROVIDER } from '@onekeyhq/shared/types/swap/dustSweep';
import type {
  ISwapProviderInfo,
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { buildDustSweepCandidates } from './candidates';

export function getDustSweepSupportedNetworks({
  networks,
  providers,
  savedProviders,
}: {
  networks: ISwapNetwork[];
  providers: ISwapServiceProvider[];
  savedProviders: ISwapProviderManager[];
}) {
  const provider = providers.find(
    (item) => item.providerInfo.provider === DUST_SWEEP_PROVIDER,
  );
  const supportedNetworkIds = new Set(
    provider?.providerServiceDisable || provider?.isSupportSingleSwap === false
      ? []
      : provider?.supportSingleSwapNetworks?.map((item) => item.networkId),
  );
  const disabledNetworkIds = new Set(
    provider?.serviceDisableNetworks?.map((item) => item.networkId),
  );
  const enabledProviders = buildUnifiedSwapProviderManagers({
    serverProviders: providers,
    swapProviderManagers: savedProviders,
    bridgeProviderManagers: [],
  });
  return networks.filter(
    (network) =>
      network.supportSingleSwap &&
      supportedNetworkIds.has(network.networkId) &&
      !disabledNetworkIds.has(network.networkId) &&
      !getDenySwapProviderString({
        providerManagers: enabledProviders,
        fromNetworkId: network.networkId,
        toNetworkId: network.networkId,
      })
        ?.split(',')
        .includes(DUST_SWEEP_PROVIDER),
  );
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

export async function loadDustSweepEntryCapabilities({
  fetchNetworks,
  fetchProviders,
  getSavedProviders,
}: {
  fetchNetworks: () => Promise<ISwapNetwork[]>;
  fetchProviders: () => Promise<ISwapServiceProvider[]>;
  getSavedProviders: () => Promise<ISwapProviderManager[]>;
}) {
  // Silence each branch independently: Promise.all may reject before another
  // branch fails, but that later error still reaches the proxy toast handler.
  const [networks, providers, savedProviders] = await Promise.all([
    loadQuietly(fetchNetworks),
    loadQuietly(fetchProviders),
    loadQuietly(getSavedProviders),
  ]);
  return getDustSweepSupportedNetworks({
    networks,
    providers,
    savedProviders,
  });
}

type IDustSweepNetworksResult = {
  networks: IDustSweepNetwork[];
  partialError: boolean;
  providerInfo?: ISwapProviderInfo;
};

const inFlightLoads = new Map<string, Promise<IDustSweepNetworksResult>>();

function getLoadKey(params: IDustSweepRouteParams) {
  return [
    params.walletId,
    params.accountId ?? '',
    params.indexedAccountId ?? '',
    params.networkId ?? '',
  ].join(':');
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

type IDustSweepNetworkContext = Omit<
  IDustSweepNetwork,
  'tokens' | 'nativeToken' | 'balanceUsd'
>;

async function loadDustSweepNetworkAssets({
  entry,
  indexedAccountId,
  isManualRefresh,
}: {
  entry: IDustSweepNetworkContext;
  indexedAccountId?: string;
  isManualRefresh: boolean;
}): Promise<IDustSweepNetwork> {
  const [response, native] = await Promise.all([
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
    backgroundApiProxy.serviceToken.getNativeToken({
      accountId: entry.accountId,
      networkId: entry.network.networkId,
    }),
  ]);
  if (!native) throw new OneKeyLocalError('Native token is unavailable');
  if (
    [response.tokens, response.smallBalanceTokens, response.riskTokens].some(
      (group) => group.currency && group.currency !== 'usd',
    )
  )
    throw new OneKeyLocalError('USD pricing is unavailable');
  const tokens = buildDustSweepCandidates(response, entry.network.networkId);
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

async function loadDustSweepNetworksInternal(
  params: IDustSweepRouteParams,
): Promise<IDustSweepNetworksResult> {
  if (
    !params.accountId ||
    accountUtils.isWatchingAccount({ accountId: params.accountId }) ||
    accountUtils.isExternalAccount({ accountId: params.accountId })
  )
    throw new OneKeyLocalError('Account is unavailable');
  const [networks, { accountsInfo }, providers, savedProviders] =
    await Promise.all([
      backgroundApiProxy.serviceSwap.fetchSwapNetworks(),
      backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: params.accountId,
        indexedAccountId: params.indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        // A single-network entry must resolve that network even when the user
        // disabled it in the All Networks aggregate view.
        networksEnabledOnly: !params.networkId,
        excludeTestNetwork: true,
        includingNonExistingAccount: false,
        includingNotEqualGlobalDeriveTypeAccount: Boolean(params.networkId),
      }),
      backgroundApiProxy.serviceSwap.getSwapProviderManager(),
      backgroundApiProxy.simpleDb.swapConfigs.getSwapProviderManager(),
    ]);
  const provider = providers.find(
    (item) => item.providerInfo.provider === DUST_SWEEP_PROVIDER,
  );
  const denySingleSwapProvider = providers
    .map((item) => item.providerInfo.provider)
    .filter((item) => item !== DUST_SWEEP_PROVIDER)
    .toSorted()
    .join(',');
  const limit = pLimit(4);
  const candidates = getDustSweepSupportedNetworks({
    networks,
    providers,
    savedProviders,
  }).filter(
    (network) =>
      (!params.networkId || network.networkId === params.networkId) &&
      accountsInfo.some(
        (account) =>
          account.networkId === network.networkId &&
          (!params.networkId || account.accountId === params.accountId),
      ),
  );
  const results = await Promise.allSettled(
    candidates.map((network) =>
      limit(async (): Promise<IDustSweepNetwork | undefined> => {
        const account = accountsInfo.find(
          (item) =>
            item.networkId === network.networkId &&
            (!params.networkId || item.accountId === params.accountId),
        );
        if (!account) return undefined;
        return loadDustSweepNetworkAssets({
          entry: {
            network,
            accountId: account.accountId,
            address: account.apiAddress,
            deriveAddressEncoding: account.deriveInfo?.addressEncoding,
            denySingleSwapProvider,
          },
          indexedAccountId: params.indexedAccountId,
          isManualRefresh: false,
        });
      }),
    ),
  );
  const data = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
  if (
    !data.length &&
    (results.some((result) => result.status === 'rejected') || params.networkId)
  )
    throw new OneKeyLocalError(
      params.networkId
        ? 'Selected network account is unavailable'
        : 'Unable to load balances',
    );
  return {
    networks: data,
    partialError: results.some((result) => result.status === 'rejected'),
    providerInfo: provider?.providerInfo,
  };
}

export function loadDustSweepNetworks(
  params: IDustSweepRouteParams,
  signal: AbortSignal,
) {
  const key = getLoadKey(params);
  let load = inFlightLoads.get(key);
  if (!load) {
    // Keep the underlying request alive when one page instance unmounts. A
    // quick re-entry can adopt the same work instead of starting a duplicate
    // fan-out for every network.
    load = loadDustSweepNetworksInternal(params);
    inFlightLoads.set(key, load);
    void load.then(
      () => {
        if (inFlightLoads.get(key) === load) inFlightLoads.delete(key);
      },
      () => {
        if (inFlightLoads.get(key) === load) inFlightLoads.delete(key);
      },
    );
  }
  return waitForLoad(load, signal);
}
