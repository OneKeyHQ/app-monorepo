import BigNumber from 'bignumber.js';
import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { buildDustSweepCandidates } from './candidates';

type IDustSweepNetworksResult = {
  networks: IDustSweepNetwork[];
  partialError: boolean;
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

async function loadDustSweepNetworksInternal(
  params: IDustSweepRouteParams,
  signal: AbortSignal,
): Promise<IDustSweepNetworksResult> {
  if (
    !params.accountId ||
    accountUtils.isWatchingAccount({ accountId: params.accountId }) ||
    accountUtils.isExternalAccount({ accountId: params.accountId })
  )
    throw new OneKeyLocalError('Account is unavailable');
  const [networks, { accountsInfo }] = await Promise.all([
    backgroundApiProxy.serviceSwap.fetchSwapNetworks(),
    backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
      accountId: params.accountId,
      indexedAccountId: params.indexedAccountId,
      networkId: getNetworkIdsMap().onekeyall,
      networksEnabledOnly: true,
      excludeTestNetwork: true,
      includingNonExistingAccount: false,
    }),
  ]);
  const limit = pLimit(4);
  const candidates = networks.filter(
    (network) =>
      network.supportSingleSwap &&
      accountsInfo.some((account) => account.networkId === network.networkId),
  );
  const results = await Promise.allSettled(
    candidates.map((network) =>
      limit(async (): Promise<IDustSweepNetwork | undefined> => {
        if (signal.aborted) return undefined;
        const account = accountsInfo.find(
          (item) => item.networkId === network.networkId,
        );
        if (!account) return undefined;
        const [response, native] = await Promise.all([
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: account.accountId,
            networkId: network.networkId,
            indexedAccountId: params.indexedAccountId,
            flag: 'dust-sweep',
            hideSmallBalanceTokens: false,
            hideRiskTokens: false,
            excludeDeFiMarkedTokens: true,
            withoutDappToken: true,
            saveToLocal: false,
            isManualRefresh: false,
          }),
          backgroundApiProxy.serviceToken.getNativeToken({
            accountId: account.accountId,
            networkId: network.networkId,
          }),
        ]);
        if (!native || signal.aborted) return undefined;
        if (
          [
            response.tokens,
            response.smallBalanceTokens,
            response.riskTokens,
          ].some((group) => group.currency && group.currency !== 'usd')
        )
          throw new OneKeyLocalError('USD pricing is unavailable');
        const tokens = buildDustSweepCandidates(response, network.networkId);
        const nativeEntry = [
          ...response.tokens.data,
          ...response.smallBalanceTokens.data,
        ].find((token) => token.isNative);
        const nativeFiat = nativeEntry
          ? (response.tokens.map[nativeEntry.$key] ??
            response.smallBalanceTokens.map[nativeEntry.$key])
          : undefined;
        return {
          network,
          accountId: account.accountId,
          address: account.apiAddress,
          tokens,
          nativeToken: {
            networkId: network.networkId,
            contractAddress: native.address,
            isNative: true,
            symbol: native.symbol,
            name: native.name,
            decimals: native.decimals,
            logoURI: native.logoURI,
            price: nativeFiat?.price?.toString(),
            balanceParsed: nativeFiat?.balanceParsed,
          },
          valueUsd: tokens
            .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
            .toFixed(),
        };
      }),
    ),
  );
  const data = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
  if (!data.length && results.some((result) => result.status === 'rejected'))
    throw new OneKeyLocalError('Unable to load balances');
  return {
    networks: data,
    partialError: results.some((result) => result.status === 'rejected'),
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
    const internalController = new AbortController();
    load = loadDustSweepNetworksInternal(params, internalController.signal);
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
