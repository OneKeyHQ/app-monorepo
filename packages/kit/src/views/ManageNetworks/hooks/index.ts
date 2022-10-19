import { useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SpeedindicatorColors } from '../../../components/NetworkAccountSelector/NetworkAccountSelectorModal/SpeedIndicator';
import { useNetwork } from '../../../hooks/useNetwork';
import { getTimeDurationMs } from '../../../utils/helper';

export enum RpcSpeed {
  Fast = 0,
  Slow,
  Unavailable,
}

export type MeasureResult = {
  responseTime?: number;
  color: SpeedindicatorColors;
  latestBlock?: number;
  speed: RpcSpeed;
};

const getRpcStatusByResponseTime = (speed?: number) => {
  if (typeof speed === 'undefined') {
    return {
      color: SpeedindicatorColors.Unavailable,
      speed: RpcSpeed.Unavailable,
    };
  }
  if (speed <= 300) {
    return {
      color: SpeedindicatorColors.Fast,
      speed: RpcSpeed.Fast,
    };
  }
  return {
    color: SpeedindicatorColors.Slow,
    speed: RpcSpeed.Slow,
  };
};

export const measureRpc = async (networkId: string, url: string) => {
  try {
    const { responseTime, latestBlock } =
      await backgroundApiProxy.serviceNetwork.getRPCEndpointStatus(
        url,
        networkId,
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
    color: SpeedindicatorColors.Unavailable,
    speed: RpcSpeed.Unavailable,
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

export const useRpcMeasureStatus = (networkId: string) => {
  const [loading, setLoading] = useState(false);
  const { network } = useNetwork({ networkId });
  const [status, setStatus] = useState<MeasureResult>();

  const refresh = useCallback(() => {
    setLoading(true);
    measureRpc(network?.id ?? '', network?.rpcURL ?? '')
      .then(setStatus)
      .finally(() => {
        setLoading(false);
      });
  }, [network]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      refresh();
    }, getTimeDurationMs({ minute: 1 }));
    return () => {
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    loading,
    status,
    refresh,
  };
};
