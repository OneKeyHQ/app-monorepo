import { useCallback, useEffect, useState } from 'react';

import {
  ERC20TokenAllowance,
  ERC721TokenAllowance,
} from '@onekeyhq/engine/src/managers/revoke';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export const useRevokeAddress = () => {
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
  const [prices, setPrices] = useState<Record<string, string>>({});
  const {
    address,
    updateAddress,
    loading: updateAddressLoading,
  } = useRevokeAddress();

  const refresh = useCallback(async () => {
    if (!address || !networkId) {
      setAllowances([]);
      return;
    }
    try {
      setLoading(true);
      setAllowances([]);
      const { allowance, prices: p } =
        await backgroundApiProxy.serviceRevoke.fetchERC20TokenAllowences(
          networkId,
          address,
        );
      setPrices(p);
      setAllowances(allowance);
    } catch (error) {
      debugLogger.http.error('getTransferEvents error', error);
    }
    setLoading(false);
  }, [address, networkId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    updateAddress(addressOrName);
  }, [addressOrName, updateAddress]);

  return {
    address,
    prices,
    loading: loading || updateAddressLoading,
    allowances,
    refresh,
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
  } = useRevokeAddress();

  const refresh = useCallback(async () => {
    if (!address || !networkId) {
      setAllowances([]);
      return;
    }
    try {
      setLoading(true);
      setAllowances([]);
      const res =
        await backgroundApiProxy.serviceRevoke.fetchERC721TokenAllowances(
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
    refresh();
  }, [refresh]);

  useEffect(() => {
    updateAddress(addressOrName);
  }, [addressOrName, updateAddress]);

  return {
    address,
    loading: loading || updateAddressLoading,
    allowances,
    refresh,
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
