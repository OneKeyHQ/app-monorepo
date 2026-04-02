import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export interface ICustomRpcCheckResult {
  isCustomRpcUnavailable: boolean;
  customRpcUrl?: string;
  isCustomNetwork: boolean;
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
): ICustomRpcCheckResult {
  const { result } = usePromiseResult(async () => {
    if (!networkId) {
      return {
        isCustomRpcUnavailable: false,
        isCustomNetwork: false,
      };
    }
    return checkCustomRpcAvailability(networkId);
  }, [networkId]);

  return {
    isCustomRpcUnavailable: result?.isCustomRpcUnavailable ?? false,
    customRpcUrl: result?.customRpcUrl,
    isCustomNetwork: result?.isCustomNetwork ?? false,
  };
}
