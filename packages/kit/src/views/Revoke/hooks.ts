import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { DeviceEventEmitter } from 'react-native';

import { useUserDevice } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  ADDRESS_ZERO,
  ERC20TokenAllowance,
  ERC721TokenAllowance,
} from '@onekeyhq/engine/src/managers/revoke';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';
import { ModalRoutes, RootRoutes, SendRoutes } from '../../routes/routesEnum';

import { AssetType } from './types';

export const useRevokeAddress = (addressOrName = '') => {
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const updateAddress = useCallback(async () => {
    setLoading(true);
    const res = await backgroundApiProxy.serviceRevoke.getAddress(
      addressOrName,
    );
    setAddress(res ?? '');
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [addressOrName]);

  useEffect(() => {
    updateAddress();
  }, [addressOrName, updateAddress]);

  return {
    updateAddress,
    address,
    loading,
  };
};

export const useTokenAllowances = (
  networkId: string,
  addressOrName: string,
  assetType: AssetType,
) => {
  const conditionRef = useRef<{ address: string; networkId: string }>();
  const [loading, setLoading] = useState(true);
  const [allowances, setAllowances] =
    useState<(ERC20TokenAllowance | ERC721TokenAllowance)[]>();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const { address, loading: updateAddressLoading } =
    useRevokeAddress(addressOrName);

  useEffect(() => {
    conditionRef.current = {
      address,
      networkId,
    };
  }, [address, networkId]);

  const refresh = useCallback(
    async (type: AssetType) => {
      if (!address || !networkId) {
        if (!updateAddressLoading) {
          setAllowances([]);
          setLoading(false);
        }
        return;
      }
      const isConditionChanged = () => {
        const { current } = conditionRef;
        return address !== current?.address || networkId !== current?.networkId;
      };
      try {
        setLoading(true);
        setAllowances([]);
        if (type === AssetType.tokens) {
          const { allowance, prices: p } =
            await backgroundApiProxy.serviceRevoke.fetchERC20TokenAllowences(
              networkId,
              address,
            );
          if (isConditionChanged()) {
            return;
          }
          setPrices(p);
          setAllowances(allowance);
        } else {
          const res =
            await backgroundApiProxy.serviceRevoke.fetchERC721TokenAllowances(
              networkId,
              address,
            );
          setAllowances(res);
        }
      } catch (error) {
        debugLogger.http.error('getTransferEvents error', error);
      }
      if (isConditionChanged()) {
        return;
      }
      setLoading(false);
    },
    [address, networkId, updateAddressLoading],
  );

  useEffect(() => {
    refresh(assetType);
    DeviceEventEmitter.addListener('Revoke:refresh', (type: AssetType) =>
      refresh(type),
    );
    return () => {
      DeviceEventEmitter.removeAllListeners();
    };
  }, [refresh, assetType]);

  return {
    address,
    prices,
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
      let encodedApproveTx: IEncodedTx;
      // erc20 tokens
      if (assetType === AssetType.tokens) {
        encodedApproveTx =
          await backgroundApiProxy.engine.buildEncodedTxFromApprove({
            amount,
            networkId,
            spender,
            accountId,
            token: contract,
          });
      } else if (typeof tokenId !== 'undefined') {
        // erc721
        encodedApproveTx =
          await backgroundApiProxy.serviceRevoke.buildEncodedTxsFromApprove({
            from: accountAddress,
            to: contract ?? '',
            approve: ADDRESS_ZERO,
            tokenId,
          });
      } else {
        // erc1155
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
              DeviceEventEmitter?.emit('Revoke:refresh', assetType);
            },
          },
        },
      });
    },
    [accountId, contract, navigation, networkId, spender, accountAddress],
  );
  return update;
};

export const useIsVerticalOrMiddleLayout = () => {
  const { size } = useUserDevice();
  return useMemo(() => ['SMALL', 'NORMAL'].includes(size), [size]);
};
