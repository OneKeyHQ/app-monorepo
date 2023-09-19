import { useCallback, useEffect, useState } from 'react';

import type { TokenSource } from '@onekeyhq/engine/src/managers/token';
import type {
  GoPlusAddressSecurity,
  GoPlusTokenSecurity,
} from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { Token } from '../../store/typings';
import type { FiatPayModeType } from '../FiatPay/types';

export const useTokenSourceList = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenSource[]>([]);
  useEffect(() => {
    setLoading(true);
    backgroundApiProxy.serviceToken
      .fetchTokenSource()
      .then((list) => {
        setData(list.filter((l) => l.count > 0));
      })
      .finally(() => setLoading(false));
  }, []);
  return {
    loading,
    data: data ?? [],
  };
};

export const useTokenSecurityInfo = (networkId?: string, address?: string) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    safe: (keyof GoPlusTokenSecurity)[];
    danger: (keyof GoPlusTokenSecurity)[];
    warn: (keyof GoPlusTokenSecurity)[];
    hasSecurity: boolean;
  }>({ safe: [], danger: [], warn: [], hasSecurity: false });

  const fetch = useCallback(() => {
    if (!networkId || !address) {
      return;
    }
    setLoading(true);
    backgroundApiProxy.serviceToken
      .getTokenRiskyItems({
        networkId,
        address,
        apiName: GoPlusSupportApis.token_security,
      })
      .then(setData)
      .finally(() => {
        setLoading(false);
      });
  }, [networkId, address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    loading,
    data,
  };
};

export const useAddressSecurityInfo = (networkId: string, address: string) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<(keyof GoPlusAddressSecurity)[]>();

  const fetch = useCallback(() => {
    if (!networkId || !address) {
      return;
    }
    setLoading(true);
    backgroundApiProxy.serviceToken
      .getAddressRiskyItems({
        address,
        networkId,
        apiName: GoPlusSupportApis.address_security,
      })
      .then(setData)
      .finally(() => {
        setLoading(false);
      });
  }, [networkId, address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    loading,
    data,
  };
};

export const useFiatPayTokens = (networkId: string, type: FiatPayModeType) => {
  const [tokenList, updateTokenList] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    backgroundApiProxy.serviceFiatPay
      .getFiatPayList({ networkId, type })
      .then((list) => {
        updateTokenList(list);
      })
      .finally(() => setLoading(false));
  }, [networkId, type]);

  return { tokenList, loading };
};
