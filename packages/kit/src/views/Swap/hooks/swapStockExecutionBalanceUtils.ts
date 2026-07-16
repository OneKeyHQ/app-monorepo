import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const STOCK_EXECUTION_BALANCE_RETRY_DELAYS_MS = [500, 1500, 4000] as const;

export function buildStockExecutionNetworkAccountScope({
  accountKey,
  displayIdentityKey,
  enabled,
  networkId,
  refreshKey,
}: {
  accountKey?: string;
  displayIdentityKey: string;
  enabled: boolean;
  networkId: string;
  refreshKey: number;
}) {
  return `${enabled ? '1' : '0'}:${networkId}:${accountKey ?? ''}:${
    displayIdentityKey
  }:${refreshKey}`;
}

export function buildStockExecutionBalanceScope({
  accountAddress,
  accountId,
  displayIdentityKey,
  networkAccountReady,
  refreshKey,
  tokenScope,
}: {
  accountAddress?: string;
  accountId?: string;
  displayIdentityKey: string;
  networkAccountReady: boolean;
  refreshKey: number;
  tokenScope: string;
}) {
  const ownerScope = `${displayIdentityKey}:${tokenScope}:${accountId ?? ''}:${
    accountAddress ?? ''
  }`;
  return {
    ownerScope,
    requestScope: `${ownerScope}:${
      networkAccountReady ? 'ready' : 'pending'
    }:${refreshKey}`,
  };
}

export async function runStockExecutionBalanceRequestWithRetry<T>({
  isUsable,
  request,
  shouldContinue = () => true,
  wait = timerUtils.wait,
}: {
  isUsable: (value: T | undefined) => boolean;
  request: () => Promise<T | undefined>;
  shouldContinue?: () => boolean;
  wait?: (delayMs: number) => Promise<unknown>;
}): Promise<T | undefined> {
  for (
    let attempt = 0;
    attempt <= STOCK_EXECUTION_BALANCE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    if (!shouldContinue()) {
      return undefined;
    }
    let value: T | undefined;
    try {
      value = await request();
    } catch {
      value = undefined;
    }
    if (isUsable(value)) {
      return value;
    }
    const retryDelay = STOCK_EXECUTION_BALANCE_RETRY_DELAYS_MS[attempt];
    if (retryDelay !== undefined) {
      await wait(retryDelay);
    }
  }
  return undefined;
}
