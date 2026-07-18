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

export async function runStockExecutionBalanceRequest<T>({
  isUsable,
  request,
  shouldContinue = () => true,
}: {
  isUsable: (value: T | undefined) => boolean;
  request: () => Promise<T | undefined>;
  shouldContinue?: () => boolean;
}): Promise<T | undefined> {
  if (!shouldContinue()) {
    return undefined;
  }
  let value: T | undefined;
  try {
    value = await request();
  } catch {
    return undefined;
  }
  return shouldContinue() && isUsable(value) ? value : undefined;
}
