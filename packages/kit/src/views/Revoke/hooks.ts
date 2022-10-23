import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  ERC20TokenAllowance,
  ERC721TokenAllowance,
} from '@onekeyhq/engine/src/managers/revoke';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export const useAddress = () => {
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const updateAddress = useCallback(async (addressOrName: string) => {
    setLoading(true);
    const res = await backgroundApiProxy.serviceRevoke.getAddress(
      addressOrName,
    );
    setAddress(res ?? '');
    setLoading(false);
  }, []);

  return {
    updateAddress,
    address,
    loading,
  };
};

export const useERC20Allowances = (
  networkId: string,
  addressOrName: string,
) => {
  const [loading, setLoading] = useState(true);
  const [allowances, setAllowances] = useState<ERC20TokenAllowance[]>();
  const [prices, setPrices] = useState<Record<string, BigNumber>>({});
  const {
    address,
    updateAddress,
    loading: updateAddressLoading,
  } = useAddress();

  const fetch = useCallback(async () => {
    if (!address || !networkId) {
      setAllowances([]);
      return;
    }
    try {
      setLoading(true);
      setAllowances([]);
      const res =
        await backgroundApiProxy.serviceRevoke.fetchERC20TokenAllowedances(
          networkId,
          address,
        );
      const addresses = res
        .map((r) => r.token.address?.toLowerCase())
        .filter((a) => !!a) as string[];
      const priceAndCharts = await backgroundApiProxy.engine.getPricesAndCharts(
        networkId,
        addresses,
        false,
      );
      setPrices(priceAndCharts[0]);
      setAllowances(res);
    } catch (error) {
      debugLogger.http.error('getTransferEvents error', error);
    }
    setLoading(false);
  }, [address, networkId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    updateAddress(addressOrName);
  }, [addressOrName, updateAddress]);

  return {
    address,
    prices,
    loading: loading || updateAddressLoading,
    allowances,
  };
};

export const useERC721Allowances = (
  networkId: string,
  addressOrName: string,
) => {
  const [loading, setLoading] = useState(true);
  const [allowances, setAllowances] = useState<ERC721TokenAllowance[]>();
  const {
    address,
    updateAddress,
    loading: updateAddressLoading,
  } = useAddress();

  const fetch = useCallback(async () => {
    if (!address || !networkId) {
      setAllowances([]);
      return;
    }
    try {
      setLoading(true);
      setAllowances([]);
      const res =
        await backgroundApiProxy.serviceRevoke.fetchERC721TokenAllowedances(
          networkId,
          address,
        );
      setAllowances(res);
    } catch (error) {
      debugLogger.http.error('getTransferEvents error', error);
    }
    setLoading(false);
  }, [address, networkId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    updateAddress(addressOrName);
  }, [addressOrName, updateAddress]);

  return {
    address,
    loading: loading || updateAddressLoading,
    allowances,
  };
};

export const useSpenderAppName = (networkId: string, spender: string) => {
  const [name, setName] = useState('');

  const fetch = useCallback(async () => {
    const n = await backgroundApiProxy.serviceRevoke.getSpenderName(
      networkId,
      spender,
    );
    setName(n);
  }, [spender, networkId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return name;
};
