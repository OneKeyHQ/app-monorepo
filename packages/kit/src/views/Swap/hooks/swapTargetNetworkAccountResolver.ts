import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export type ISwapTargetNetworkAccountRequestState = {
  account?: INetworkAccount;
  key?: string;
  status: 'idle' | 'pending' | 'resolved' | 'failed';
};

export type ISwapTargetNetworkAccountResolutionStatus =
  | 'owner-pending'
  | 'not-required'
  | 'pending'
  | 'resolved'
  | 'failed';

const targetNetworkAccountRequests = new Map<
  string,
  Promise<INetworkAccount>
>();

export const SWAP_TARGET_NETWORK_ACCOUNT_REQUEST_TIMEOUT_MS = 15_000;

export function buildSwapTargetNetworkAccountResolutionPlan({
  accountId,
  activeAccountReady,
  activeNetworkId,
  deriveType,
  indexedAccountId,
  isAllNetwork,
  tokenNetworkId,
}: {
  accountId?: string;
  activeAccountReady: boolean;
  activeNetworkId?: string;
  deriveType?: string;
  indexedAccountId?: string;
  isAllNetwork: boolean;
  tokenNetworkId?: string;
}) {
  const shouldResolve = Boolean(
    tokenNetworkId &&
    activeAccountReady &&
    (indexedAccountId || accountId) &&
    (isAllNetwork || activeNetworkId !== tokenNetworkId),
  );
  return {
    key:
      shouldResolve && tokenNetworkId
        ? [
            tokenNetworkId,
            indexedAccountId ?? '',
            accountId ?? '',
            deriveType ?? '',
          ].join('|')
        : undefined,
    shouldResolve,
  };
}

export function getSwapTargetNetworkAccountResolution({
  activeAccountReady,
  requestState,
  targetKey,
}: {
  activeAccountReady: boolean;
  requestState: ISwapTargetNetworkAccountRequestState;
  targetKey?: string;
}): {
  account?: INetworkAccount;
  isAddressInfoReady: boolean;
  status: ISwapTargetNetworkAccountResolutionStatus;
} {
  if (!activeAccountReady) {
    return {
      isAddressInfoReady: false,
      status: 'owner-pending',
    };
  }
  if (!targetKey) {
    return {
      isAddressInfoReady: true,
      status: 'not-required',
    };
  }
  if (requestState.key !== targetKey || requestState.status === 'idle') {
    return {
      isAddressInfoReady: false,
      status: 'pending',
    };
  }
  if (requestState.status === 'resolved') {
    return {
      account: requestState.account,
      isAddressInfoReady: true,
      status: 'resolved',
    };
  }
  if (requestState.status === 'failed') {
    return {
      isAddressInfoReady: false,
      status: 'failed',
    };
  }
  return {
    isAddressInfoReady: false,
    status: 'pending',
  };
}

export function resolveSwapTargetNetworkAccount({
  key,
  resolve,
  timeoutMs = SWAP_TARGET_NETWORK_ACCOUNT_REQUEST_TIMEOUT_MS,
}: {
  key: string;
  resolve: () => Promise<INetworkAccount>;
  timeoutMs?: number;
}): Promise<INetworkAccount> {
  const existingRequest = targetNetworkAccountRequests.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const sourceRequest = Promise.resolve(resolve());
  const timeoutRequest = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new OneKeyLocalError(
          'Swap target-network account resolution timed out',
        ),
      );
    }, timeoutMs);
  });
  const request = Promise.race([sourceRequest, timeoutRequest]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
  targetNetworkAccountRequests.set(key, request);
  const removeRequest = () => {
    if (targetNetworkAccountRequests.get(key) === request) {
      targetNetworkAccountRequests.delete(key);
    }
  };
  void request.then(removeRequest, removeRequest);
  return request;
}
