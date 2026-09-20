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

export async function loadDustSweepNetworks(
  params: IDustSweepRouteParams,
  signal: AbortSignal,
) {
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
