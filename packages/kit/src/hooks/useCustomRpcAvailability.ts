import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import { usePromiseResult } from './usePromiseResult';

export interface ICustomRpcCheckResult {
  isCustomRpcUnavailable: boolean;
  customRpcUrl?: string;
  isCustomNetwork: boolean;
}

export interface IUseCustomRpcAvailabilityResult extends ICustomRpcCheckResult {
  isLoading: boolean;
  fingerprint: string;
}

export async function checkCustomRpcAvailability(
  networkId: string,
): Promise<ICustomRpcCheckResult> {
  const customRpcInfo =
    await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(networkId);

  if (!customRpcInfo?.rpc || !customRpcInfo?.enabled) {
    return {
      isCustomRpcUnavailable: false,
      isCustomNetwork: false,
    };
  }

  const isCustomNetwork =
    await backgroundApiProxy.serviceNetwork.isCustomNetwork({ networkId });
  if (isCustomNetwork) {
    return {
      isCustomRpcUnavailable: false,
      isCustomNetwork: true,
    };
  }

  try {
    await backgroundApiProxy.serviceCustomRpc.measureRpcStatus({
      networkId,
      rpcUrl: customRpcInfo.rpc,
      validateChainId: true,
    });
    return {
      isCustomRpcUnavailable: false,
      customRpcUrl: customRpcInfo.rpc,
      isCustomNetwork: false,
    };
  } catch {
    return {
      isCustomRpcUnavailable: true,
      customRpcUrl: customRpcInfo.rpc,
      isCustomNetwork: false,
    };
  }
}

export function useCustomRpcAvailability(
  networkId: string | undefined,
): IUseCustomRpcAvailabilityResult {
  const { result, isLoading } = usePromiseResult(async () => {
    if (!networkId) {
      return {
        isCustomRpcUnavailable: false,
        isCustomNetwork: false,
      };
    }
    return checkCustomRpcAvailability(networkId);
  }, [networkId]);

  const availabilityIsLoading = Boolean(isLoading) || result === undefined;
  const isCustomRpcUnavailable = result?.isCustomRpcUnavailable ?? false;
  const isCustomNetwork = result?.isCustomNetwork ?? false;
  let status = 'available';
  if (availabilityIsLoading) {
    status = 'pending';
  } else if (isCustomRpcUnavailable) {
    status = 'unavailable';
  } else if (isCustomNetwork) {
    status = 'custom-network';
  }

  return {
    isCustomRpcUnavailable,
    customRpcUrl: result?.customRpcUrl,
    isCustomNetwork,
    isLoading: availabilityIsLoading,
    fingerprint: stableStringify({
      networkId: networkId ?? null,
      status,
      customRpcUrl: result?.customRpcUrl ?? null,
      isCustomNetwork,
    }),
  };
}
