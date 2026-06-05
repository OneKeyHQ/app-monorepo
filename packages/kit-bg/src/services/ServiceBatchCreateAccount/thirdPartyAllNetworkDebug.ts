import type { IHwAllNetworkPrepareAccountsItem } from '../../vaults/types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

const LOG_PREFIX = '[HW-ALL-NETWORK]';

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function debugAllNetworkLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}

export function summarizeAllNetworkBundle(bundle: AllNetworkAddressParams[]) {
  return bundle.map((item, index) => ({
    index,
    network: item.network,
    methodName: (item as { methodName?: unknown }).methodName,
    path: item.path,
    showOnOneKey: item.showOnOneKey,
    showOnDevice: (item as { showOnDevice?: unknown }).showOnDevice,
    chainId: (item as { chainId?: unknown }).chainId,
    useTweak: (item as { useTweak?: unknown }).useTweak,
    hasDeviceId: typeof (item as { deviceId?: unknown }).deviceId === 'string',
  }));
}

export function summarizeAllNetworkItems(
  items: IHwAllNetworkPrepareAccountsItem[] | undefined,
) {
  return (items || []).map((item, index) => {
    const payload = item.payload as Record<string, unknown> | undefined;
    return {
      index,
      network: item.network,
      methodName: (item as { methodName?: unknown }).methodName,
      path: item.path,
      success: item.success,
      code: payload?.code,
      error: payload?.error,
      appName: payload?.appName,
      tag: payload?._tag,
      hasAddress: typeof payload?.address === 'string',
      hasPublicKey: typeof payload?.publicKey === 'string',
      hasChainFingerprint: typeof payload?.chainFingerprint === 'string',
      chainFingerprintChain: payload?.chainFingerprintChain,
    };
  });
}

export function summarizeAllNetworkSdkResponse(
  response:
    | {
        success: boolean;
        payload?: unknown;
      }
    | undefined,
) {
  if (!response) {
    return undefined;
  }
  if (response.success && Array.isArray(response.payload)) {
    return {
      success: true,
      items: summarizeAllNetworkItems(
        response.payload as IHwAllNetworkPrepareAccountsItem[],
      ),
    };
  }
  const payload = response.payload as Record<string, unknown> | undefined;
  return {
    success: response.success,
    code: payload?.code,
    error: payload?.error,
    appName: payload?.appName,
    tag: payload?._tag,
  };
}
