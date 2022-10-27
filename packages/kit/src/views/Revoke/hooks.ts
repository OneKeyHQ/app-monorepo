import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { DeviceEventEmitter } from 'react-native';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  ADDRESS_ZERO,
  ERC20TokenAllowance,
  ERC721TokenAllowance,
} from '@onekeyhq/engine/src/managers/revoke';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';
import { ModalRoutes, RootRoutes, SendRoutes } from '../../routes/routesEnum';

import { AssetType } from './FilterBar';

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
      setLoading(false);
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
    DeviceEventEmitter.addListener('Revoke:refresh', refresh);
    return () => {
      DeviceEventEmitter.removeAllListeners();
    };
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
      setLoading(false);
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

  return name || shortenAddress(spender);
};

export const useAccountCanTransaction = (address: string) => {
  const { account, wallet } = useActiveWalletAccount();

  return useMemo(
    () =>
      account &&
      account.id &&
      account?.address.toLowerCase() === address.toLowerCase() &&
      wallet?.type !== WALLET_TYPE_WATCHING,
    [account, address, wallet?.type],
  );
};

export const useUpdateAllowance = ({
  networkId,
  spender,
  contract,
}: {
  networkId: string;
  spender: string;
  contract: string;
}) => {
  const navigation = useNavigation();
  const { accountId, accountAddress } = useActiveWalletAccount();
  const update = useCallback(
    async ({
      amount,
      tokenId,
      assetType,
    }: {
      tokenId?: string;
      assetType: AssetType;
      amount: string;
    }) => {
      let encodedApproveTx =
        await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          amount,
          networkId,
          spender,
          accountId,
          token: contract,
        });
      if (assetType === AssetType.nfts) {
        if (typeof tokenId !== 'undefined') {
          encodedApproveTx =
            await backgroundApiProxy.serviceRevoke.buildEncodedTxsFromApprove({
              from: accountAddress,
              to: contract ?? '',
              approve: ADDRESS_ZERO,
              tokenId,
            });
        } else {
          encodedApproveTx =
            await backgroundApiProxy.serviceRevoke.buildEncodedTxsFromSetApprovalForAll(
              {
                from: accountAddress,
                to: contract ?? '',
                approved: false,
                spender,
              },
            );
        }
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            accountId,
            networkId,
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            skipSaveHistory: false,
            encodedTx: encodedApproveTx,
            onSuccess: () => {
              DeviceEventEmitter?.emit('Revoke:refresh');
            },
          },
        },
      });
    },
    [accountId, contract, navigation, networkId, spender, accountAddress],
  );
  return update;
};
