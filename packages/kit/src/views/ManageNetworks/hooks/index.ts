import { useCallback, useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';

import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks/useNetwork';
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

// TODO debounce and cache, multiple setInterval created
export const useRpcMeasureStatus = (networkId: string) => {
  const [loading, setLoading] = useState(false);
  const { network } = useNetwork({ networkId });
  const [status, setStatus] = useState<MeasureResult>();
  const isFocused = useIsFocused();

  const refresh = useCallback(() => {
    setLoading(true);
    measureRpc(network?.id ?? '', network?.rpcURL ?? '')
      .then((newStatus) => {
        if (isFocused) setStatus(newStatus);
      })
      .finally(() => {
        if (isFocused) setLoading(false);
      });
  }, [network, isFocused]);

  useEffect(() => {
    const timer = setTimeout(() => refresh(), 600);
    const interval = setInterval(() => {
      refresh();
    }, getTimeDurationMs({ minute: 1 }));
    if (!isFocused) {
      clearInterval(interval);
      clearTimeout(timer);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [refresh, isFocused]);

  return {
    loading,
    status,
    refresh,
  };
};
