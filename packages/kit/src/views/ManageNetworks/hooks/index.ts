import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { getTimeDurationMs } from '../../../utils/helper';

export const RpcSpeed = {
  Fast: {
    iconColor: 'icon-success',
    textColor: 'text-success',
    text: 'content__fast',
  },
  Slow: {
    iconColor: 'icon-warning',
    textColor: 'text-warning',
    text: 'content__slow',
  },
  Unavailable: {
    iconColor: 'icon-critical',
    textColor: 'text-critical',
    text: 'content__check_node',
  },
} as const;

export type MeasureResult = {
  responseTime?: number;
  latestBlock?: number;
  iconColor: 'icon-success' | 'icon-warning' | 'icon-critical';
  textColor: ThemeToken;
  text: 'content__fast' | 'content__slow' | 'content__check_node';
};

const getRpcStatusByResponseTime = (speed?: number) => {
  if (typeof speed === 'undefined') {
    return RpcSpeed.Unavailable;
  }
  if (speed <= 800) {
    return RpcSpeed.Fast;
  }
  return RpcSpeed.Slow;
};

export const measureRpc = async (
  networkId: string,
  url: string,
  useCache = true,
) => {
  try {
    const { responseTime, latestBlock } =
      await backgroundApiProxy.serviceNetwork.getRPCEndpointStatus(
        url,
        networkId,
        useCache,
      );

    return {
      latestBlock,
      responseTime,
      ...getRpcStatusByResponseTime(responseTime),
    };
  } catch (error) {
    // pass
  }
  return {
    latestBlock: undefined,
    responseTime: undefined,
    ...RpcSpeed.Unavailable,
  };
};

export const useRPCUrls = (networkId?: string) => {
  const [defaultRpc, setDefaultRpc] = useState<string>();
  const [preset, setPreset] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);

  const refresh = useCallback(() => {
    if (!networkId) {
      return;
    }
    const { serviceNetwork } = backgroundApiProxy;
    serviceNetwork
      .getPresetRpcEndpoints(networkId)
      .then(({ urls, defaultRpcURL }) => {
        setPreset(urls);
        setDefaultRpc(defaultRpcURL);
      });

    serviceNetwork.getCustomRpcUrls(networkId).then((urls) => {
      setCustom(urls || []);
    });
  }, [networkId]);

  useEffect(refresh, [refresh]);

  return {
    defaultRpc,
    preset,
    custom,
    refresh,
  };
};

export const useRpcMeasureStatus = (networkId?: string) => {
  const activeNetworkId = useAppSelector((s) => s.general.activeNetworkId);
  const status = useAppSelector(
    (s) => s.status.rpcStatus?.[networkId ?? activeNetworkId ?? ''],
  );

  return useMemo(() => {
    const isOutofDated =
      Date.now() - (status?.updatedAt ?? 0) > getTimeDurationMs({ minute: 2 });

    if (!status || isOutofDated) {
      return {
        status: {
          latestBlock: undefined,
          responseTime: undefined,
          ...RpcSpeed.Unavailable,
        },
        loading: true,
      };
    }

    return {
      status: {
        ...status,
        ...getRpcStatusByResponseTime(status.responseTime),
      },
      loading: !status,
    };
  }, [status]);
};
