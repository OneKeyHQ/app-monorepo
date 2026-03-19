import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import {
  createEarnPortfolioInvestmentKey,
  createEarnPortfolioInvestmentKeyFromInvestment,
  matchesEarnPortfolioRefreshOptions,
  normalizeEarnPortfolioAirdropInvestment,
  normalizeEarnPortfolioInvestment,
} from './earnPortfolioShared';

import type {
  IPortfolioFetchRequest,
  IPortfolioPatch,
  IRefreshOptions,
} from './earnPortfolioShared';

type IEarnAvailableAccountParams = Awaited<
  ReturnType<
    typeof backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams
  >
>[number];

type IEarnBatchInvestmentDetailResponse = Awaited<
  ReturnType<
    typeof backgroundApiProxy.serviceStaking.fetchInvestmentBatchDetail
  >
>;

type IEarnPortfolioStreamTask = {
  keys: string[];
  run: () => Promise<{
    patches: IPortfolioPatch[];
    failedKeys: string[];
  }>;
};

type IEarnBatchTaskGroup = {
  provider: string;
  networkId: string;
  accountAddress: string;
  publicKey?: string;
  requestsByKey: Map<string, IPortfolioFetchRequest>;
  requestKeysBySymbol: Map<string, Set<string>>;
};

type IEarnPortfolioStreamArgs = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  options?: IRefreshOptions;
  existingInvestments: IEarnPortfolioInvestment[];
  onAccounts?: (accounts: IEarnAvailableAccountParams[]) => void;
  onPatches?: (patches: IPortfolioPatch[]) => void;
  onFinished?: (payload: { staleKeys: string[] }) => void;
};

const STREAM_CONCURRENCY = 6;

const createPortfolioRequestKey = (request: IPortfolioFetchRequest) =>
  createEarnPortfolioInvestmentKey({
    provider: request.provider,
    symbol: request.symbol,
    vault: request.vault,
    networkId: request.networkId,
  });

const addRequestToBatchGroup = ({
  group,
  key,
  request,
}: {
  group: IEarnBatchTaskGroup;
  key: string;
  request: IPortfolioFetchRequest;
}) => {
  group.requestsByKey.set(key, request);

  const existingKeys = group.requestKeysBySymbol.get(request.symbol);
  if (existingKeys) {
    existingKeys.add(key);
    return;
  }

  group.requestKeysBySymbol.set(request.symbol, new Set([key]));
};

const matchBatchRequest = ({
  group,
  symbol,
  vault,
}: {
  group: IEarnBatchTaskGroup;
  symbol: string;
  vault?: string;
}) => {
  const exactKey = createEarnPortfolioInvestmentKey({
    provider: group.provider,
    symbol,
    vault,
    networkId: group.networkId,
  });
  const exactRequest = group.requestsByKey.get(exactKey);
  if (exactRequest) {
    return exactRequest;
  }

  const symbolKeys = group.requestKeysBySymbol.get(symbol);
  if (symbolKeys?.size === 1) {
    const [matchedKey] = symbolKeys;
    if (matchedKey) {
      return group.requestsByKey.get(matchedKey);
    }
  }

  return undefined;
};

async function runEarnPortfolioTaskPool({
  tasks,
  onTaskSuccess,
  onTaskError,
}: {
  tasks: IEarnPortfolioStreamTask[];
  onTaskSuccess: (payload: {
    patches: IPortfolioPatch[];
    failedKeys: string[];
  }) => void;
  onTaskError: (task: IEarnPortfolioStreamTask, error: unknown) => void;
}) {
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex];
      nextIndex += 1;
      if (!task) {
        return;
      }

      try {
        onTaskSuccess(await task.run());
      } catch (error) {
        onTaskError(task, error);
      }
    }
  };

  const workerCount = Math.min(STREAM_CONCURRENCY, tasks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await worker();
    }),
  );
}

const buildBatchTask = ({
  accountId,
  group,
}: {
  accountId: string;
  group: IEarnBatchTaskGroup;
}): IEarnPortfolioStreamTask => ({
  keys: Array.from(group.requestsByKey.keys()),
  run: async () => {
    const response: IEarnBatchInvestmentDetailResponse =
      await backgroundApiProxy.serviceStaking.fetchInvestmentBatchDetail({
        accountId,
        accountAddress: group.accountAddress,
        networkId: group.networkId,
        provider: group.provider,
        publicKey: group.publicKey,
      });

    const patches = response.items
      .map((item) => {
        const matchedRequest = matchBatchRequest({
          group,
          symbol:
            item.protocol.symbol || item.assets[0]?.token.info.symbol || '',
          vault: item.protocol.vault,
        });

        if (!matchedRequest) {
          return null;
        }

        return normalizeEarnPortfolioInvestment({
          request: matchedRequest,
          result: item,
        });
      })
      .filter((patch): patch is IPortfolioPatch => Boolean(patch))
      .filter((patch) => group.requestsByKey.has(patch.key));

    const failedKeys = response.errors
      .map((errorItem) => {
        const matchedRequest = matchBatchRequest({
          group,
          symbol: errorItem.symbol,
          vault: errorItem.vault,
        });

        return matchedRequest
          ? createPortfolioRequestKey(matchedRequest)
          : null;
      })
      .filter((key): key is string => Boolean(key));

    return { patches, failedKeys };
  },
});

const buildSingleTask = ({
  request,
}: {
  request: IPortfolioFetchRequest;
}): IEarnPortfolioStreamTask => ({
  keys: [createPortfolioRequestKey(request)],
  run: async () => {
    const result =
      await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2({
        accountId: request.accountId,
        accountAddress: request.accountAddress,
        networkId: request.networkId,
        provider: request.provider,
        publicKey: request.publicKey,
        symbol: request.symbol,
        vault: request.vault,
        ptAddress: request.ptAddress,
      });

    return {
      patches: [
        normalizeEarnPortfolioInvestment({
          request,
          result,
        }),
      ],
      failedKeys: [],
    };
  },
});

const buildAirdropTask = ({
  request,
}: {
  request: IPortfolioFetchRequest;
}): IEarnPortfolioStreamTask => ({
  keys: [createPortfolioRequestKey(request)],
  run: async () => {
    const result =
      await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail({
        accountId: request.accountId,
        accountAddress: request.accountAddress,
        networkId: request.networkId,
        provider: request.provider,
        publicKey: request.publicKey,
        symbol: request.symbol,
        vault: request.vault,
        ptAddress: request.ptAddress,
      });

    return {
      patches: [
        normalizeEarnPortfolioAirdropInvestment({
          request,
          result,
        }),
      ],
      failedKeys: [],
    };
  },
});

const buildEarnPortfolioStreamTasks = ({
  accountId,
  assets,
  accounts,
  options,
}: {
  accountId: string;
  assets: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceStaking.getAvailableAssetsV2>
  >;
  accounts: IEarnAvailableAccountParams[];
  options?: IRefreshOptions;
}) => {
  const requestKeys = new Set<string>();
  const batchGroupMap = new Map<string, IEarnBatchTaskGroup>();
  const tasks: IEarnPortfolioStreamTask[] = [];

  accounts.forEach((accountItem) => {
    assets
      .filter(
        (asset) =>
          asset.networkId === accountItem.networkId &&
          matchesEarnPortfolioRefreshOptions({
            asset,
            options,
          }),
      )
      .forEach((asset) => {
        const request: IPortfolioFetchRequest = {
          accountId,
          accountAddress: accountItem.accountAddress,
          networkId: accountItem.networkId,
          provider: asset.provider,
          symbol: asset.symbol,
          ...(accountItem.publicKey && {
            publicKey: accountItem.publicKey,
          }),
          vault: asset.vault,
          ptAddress: asset.ptAddress,
        };

        const key = createPortfolioRequestKey(request);
        requestKeys.add(key);

        if (asset.type === 'airdrop') {
          tasks.push(buildAirdropTask({ request }));
          return;
        }

        // Keep batch only for requests that remain uniquely addressable without
        // request-only market fields like ptAddress.
        if (asset.enableBatch && !asset.ptAddress) {
          const groupKey = [
            request.provider,
            request.networkId,
            request.accountAddress,
            request.publicKey || '',
          ].join('_');
          const existingGroup = batchGroupMap.get(groupKey);

          if (existingGroup) {
            addRequestToBatchGroup({
              group: existingGroup,
              key,
              request,
            });
            return;
          }

          const nextGroup: IEarnBatchTaskGroup = {
            provider: request.provider,
            networkId: request.networkId,
            accountAddress: request.accountAddress,
            publicKey: request.publicKey,
            requestsByKey: new Map(),
            requestKeysBySymbol: new Map(),
          };
          addRequestToBatchGroup({
            group: nextGroup,
            key,
            request,
          });
          batchGroupMap.set(groupKey, nextGroup);
          return;
        }

        tasks.push(buildSingleTask({ request }));
      });
  });

  batchGroupMap.forEach((group) => {
    const batchableGroup: IEarnBatchTaskGroup = {
      ...group,
      requestsByKey: new Map(),
      requestKeysBySymbol: new Map(),
    };

    group.requestsByKey.forEach((request, key) => {
      const requestKeysForSymbol = group.requestKeysBySymbol.get(
        request.symbol,
      );
      if ((requestKeysForSymbol?.size || 0) > 1) {
        tasks.push(buildSingleTask({ request }));
        return;
      }

      addRequestToBatchGroup({
        group: batchableGroup,
        key,
        request,
      });
    });

    if (batchableGroup.requestsByKey.size === 0) {
      return;
    }

    tasks.push(
      buildBatchTask({
        accountId,
        group: batchableGroup,
      }),
    );
  });

  return {
    tasks,
    requestKeys,
  };
};

export async function streamEarnPortfolio({
  accountId,
  networkId,
  indexedAccountId,
  options,
  existingInvestments,
  onAccounts,
  onPatches,
  onFinished,
}: IEarnPortfolioStreamArgs) {
  const [assets, accounts] = await Promise.all([
    backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
    backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
      accountId,
      networkId,
      indexedAccountId,
    }),
  ]);

  onAccounts?.(accounts);

  const { tasks, requestKeys } = buildEarnPortfolioStreamTasks({
    accountId,
    assets,
    accounts,
    options,
  });

  const touchedKeys = new Set<string>();
  const failedKeys = new Set<string>();
  const existingKeys = new Set(
    existingInvestments.map(createEarnPortfolioInvestmentKeyFromInvestment),
  );

  await runEarnPortfolioTaskPool({
    tasks,
    onTaskSuccess: ({ patches, failedKeys: taskFailedKeys }) => {
      taskFailedKeys.forEach((key) => failedKeys.add(key));
      if (patches.length === 0) {
        return;
      }

      patches.forEach((patch) => touchedKeys.add(patch.key));
      onPatches?.(patches);
    },
    onTaskError: (task, error) => {
      defaultLogger.app.error.log(
        `[streamEarnPortfolio] task failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      task.keys.forEach((key) => failedKeys.add(key));
    },
  });

  if (options) {
    onFinished?.({ staleKeys: [] });
    return;
  }

  const staleKeys = Array.from(existingKeys).filter(
    (key) =>
      !requestKeys.has(key) || (!touchedKeys.has(key) && !failedKeys.has(key)),
  );

  onFinished?.({ staleKeys });
}
