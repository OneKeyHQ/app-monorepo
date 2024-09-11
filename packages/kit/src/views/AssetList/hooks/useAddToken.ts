import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDebouncedCallback } from 'use-debounce';

import { useForm } from '@onekeyhq/components';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAccountToken, IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { UseFormReturn } from 'react-hook-form';

type IFormValues = {
  networkId: string;
  contractAddress: string;
  symbol: string;
  decimals: string;
};

export function useAddTokenForm({
  token,
  networkId,
}: {
  token?: IAccountToken;
  networkId: string;
}) {
  const isAllNetwork = networkUtils.isAllNetwork({ networkId });
  const getDefaultNetwork = useCallback(() => {
    if (token && token.networkId) {
      return token.networkId;
    }
    if (isAllNetwork) {
      return getNetworkIdsMap().eth;
    }
    return networkId;
  }, [isAllNetwork, networkId, token]);

  const form = useForm<IFormValues>({
    values: {
      networkId: getDefaultNetwork(),
      contractAddress: token?.address || '',
      symbol: token?.symbol || '',
      decimals: token?.decimals ? new BigNumber(token.decimals).toString() : '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const selectedNetworkIdValue = form.watch('networkId');
  const contractAddressValue = form.watch('contractAddress');
  const symbolValue = form.watch('symbol');
  const decimalsValue = form.watch('decimals');
  const [isEmptyContract, setIsEmptyContract] = useState(false);

  const firstRenderRef = useRef(true);
  const setIsEmptyContractState = useCallback(
    (value: boolean) => {
      if (firstRenderRef.current) {
        return;
      }
      if (!token?.address && !contractAddressValue) {
        return;
      }
      setIsEmptyContract(value);
    },
    [contractAddressValue, token?.address],
  );

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    void form.trigger('contractAddress');
  }, [isEmptyContract, form]);

  return {
    form,
    isEmptyContract,
    setIsEmptyContractState,
    selectedNetworkIdValue,
    contractAddressValue,
    symbolValue,
    decimalsValue,
  };
}

export function useAddToken({
  token,
  walletId,
  networkId,
  form,
  selectedNetworkIdValue,
  contractAddressValue,
  setIsEmptyContractState,
}: {
  token?: IAccountToken;
  walletId: string;
  networkId: string;
  form: UseFormReturn<IFormValues, any, undefined>;
  selectedNetworkIdValue: string;
  contractAddressValue: string;
  setIsEmptyContractState: (value: boolean) => void;
  checkAccountIsExist: () => Promise<{
    hasExistAccountFlag: boolean;
    accountIdForNetwork: string;
  }>;
}) {
  const { result: availableNetworks } = usePromiseResult(async () => {
    const resp =
      await backgroundApiProxy.serviceNetwork.getCustomTokenEnabledNetworks({
        currentNetworkId: networkId,
      });
    const networkIds = resp.map((o) => o.id);
    const network = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    // merge network for unsupported network, e.g. btc
    if (token?.networkId && !networkIds.includes(token.networkId)) {
      networkIds.push(token.networkId);
    }
    return {
      networkIds,
      network,
    };
  }, [networkId, token?.networkId]);

  const searchedTokenRef = useRef<IToken>();
  const fetchContractList = useDebouncedCallback(
    async (params: { value: string; networkId: string }) => {
      if (!token && !params.value.trim()) {
        form.setValue('symbol', '');
        form.setValue('decimals', '');
        setIsEmptyContractState(true);
        return;
      }
      const searchResult =
        await backgroundApiProxy.serviceCustomToken.searchTokenByContractAddress(
          {
            walletId,
            networkId: params.networkId,
            contractAddress: params.value.trim(),
            isNative: token?.isNative ?? false,
          },
        );
      if (
        Array.isArray(searchResult) &&
        searchResult.length > 0 &&
        searchResult[0]?.info
      ) {
        const [firstToken] = searchResult;
        form.setValue('symbol', firstToken.info.symbol);
        form.setValue(
          'decimals',
          new BigNumber(firstToken.info.decimals).toString(),
        );
        searchedTokenRef.current = firstToken.info;
        setIsEmptyContractState(false);
      } else {
        form.setValue('symbol', '');
        form.setValue('decimals', '');
        setIsEmptyContractState(true);
      }
    },
    300,
  );

  useEffect(() => {
    void fetchContractList({
      value: contractAddressValue,
      networkId: selectedNetworkIdValue,
    });
  }, [contractAddressValue, selectedNetworkIdValue, fetchContractList]);

  return {
    availableNetworks,
    searchedTokenRef,
  };
}

export function useAccountInfoForManageToken() {
  const findAccountInfoForNetwork = useCallback(
    async ({
      accountId,
      networkId,
      isOthersWallet,
      indexedAccountId,
      deriveType,
      selectedNetworkId,
    }: {
      accountId: string;
      networkId: string;
      isOthersWallet?: boolean;
      indexedAccountId?: string;
      deriveType: IAccountDeriveTypes;
      selectedNetworkId: string;
    }) => {
      const { serviceAccount } = backgroundApiProxy;
      let hasExistAccountFlag = false;
      let accountIdForNetwork = '';
      try {
        if (isOthersWallet) {
          const r = await serviceAccount.getAccount({
            accountId,
            networkId,
          });
          accountIdForNetwork = r.id;
        } else {
          const networkAccount = await serviceAccount.getNetworkAccount({
            accountId: undefined,
            indexedAccountId,
            networkId: selectedNetworkId,
            deriveType,
          });
          accountIdForNetwork = networkAccount.id;
        }
        hasExistAccountFlag = true;
      } catch (e) {
        hasExistAccountFlag = false;
      }

      return {
        hasExistAccountFlag,
        accountIdForNetwork,
      };
    },
    [],
  );
  return { findAccountInfoForNetwork };
}

export function useCheckAccountExist({
  accountId,
  networkId,
  isOthersWallet,
  indexedAccountId,
  deriveType,
  selectedNetworkIdValue,
}: {
  accountId: string;
  networkId: string;
  isOthersWallet?: boolean;
  indexedAccountId?: string;
  deriveType: IAccountDeriveTypes;
  selectedNetworkIdValue: string;
}) {
  const { findAccountInfoForNetwork } = useAccountInfoForManageToken();
  const checkAccountIsExist = useCallback(
    async () =>
      findAccountInfoForNetwork({
        accountId,
        networkId,
        isOthersWallet,
        indexedAccountId,
        deriveType,
        selectedNetworkId: selectedNetworkIdValue,
      }),
    [
      accountId,
      indexedAccountId,
      networkId,
      isOthersWallet,
      deriveType,
      selectedNetworkIdValue,
      findAccountInfoForNetwork,
    ],
  );

  const { result: hasExistAccount, run: runCheckAccountExist } =
    usePromiseResult(async () => {
      const { hasExistAccountFlag } = await checkAccountIsExist();
      return hasExistAccountFlag;
    }, [checkAccountIsExist]);

  return {
    hasExistAccount,
    runCheckAccountExist,
    checkAccountIsExist,
  };
}
