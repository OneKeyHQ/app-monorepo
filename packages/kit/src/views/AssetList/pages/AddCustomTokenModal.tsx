import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import { Form, Input, Page, Toast, useForm } from '@onekeyhq/components';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  IAccountToken,
  IToken,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  networkId: string;
  contractAddress: string;
  symbol: string;
  decimals: string;
};

function AddCustomTokenModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.AddCustomTokenModal
      >
    >();
  const {
    walletId,
    networkId,
    indexedAccountId,
    accountId,
    isOthersWallet,
    deriveType,
    token,
    onSuccess,
  } = route.params;

  const form = useForm<IFormValues>({
    values: {
      networkId: networkId ?? getNetworkIdsMap().eth,
      contractAddress: token?.address || '',
      symbol: token?.symbol || '',
      decimals: token?.decimals ? new BigNumber(token.decimals).toString() : '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const contractAddressValue = form.watch('contractAddress');

  const searchedTokenRef = useRef<IToken>();
  const throttledSearchContractRef = useRef(
    throttle(async (value) => {
      const searchResult =
        await backgroundApiProxy.serviceCustomToken.searchTokenByContractAddress(
          {
            walletId,
            networkId,
            contractAddress: value,
            isNative: token?.isNative ?? false,
          },
        );
      if (Array.isArray(searchResult) && searchResult.length > 0) {
        const [firstToken] = searchResult;
        form.setValue('symbol', firstToken.info.symbol);
        form.setValue(
          'decimals',
          new BigNumber(firstToken.info.decimals).toString(),
        );
        searchedTokenRef.current = firstToken.info;
      } else {
        form.setValue('symbol', '');
        form.setValue('decimals', '');
      }
    }, 300),
  );
  useEffect(() => {
    void throttledSearchContractRef.current(contractAddressValue);
  }, [contractAddressValue]);

  // MARK: - Check account if exist
  const checkAccountIsExist = useCallback(async () => {
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
          networkId,
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
  }, [accountId, indexedAccountId, networkId, isOthersWallet, deriveType]);

  // MARK: - Fetch exist token list
  const tokenListFetchFinishedRef = useRef(false);
  const fetchTokenList = useCallback(
    async (params: { accountId: string }) => {
      const { serviceToken } = backgroundApiProxy;
      const t = await serviceToken.fetchAccountTokens({
        accountId: params.accountId,
        networkId,
        mergeTokens: true,
        flag: 'custom-token',
      });
      return t.allTokens;
    },
    [networkId],
  );
  const { result: existTokenList } = usePromiseResult(async () => {
    const { hasExistAccountFlag, accountIdForNetwork } =
      await checkAccountIsExist();
    let allTokens: ITokenData | undefined;
    let hiddenTokens: IAccountToken[] = [];
    tokenListFetchFinishedRef.current = false;
    if (hasExistAccountFlag) {
      allTokens = await fetchTokenList({ accountId: accountIdForNetwork });
      hiddenTokens =
        await backgroundApiProxy.serviceCustomToken.getHiddenTokens({
          accountId: accountIdForNetwork,
          networkId,
        });
      tokenListFetchFinishedRef.current = true;
    }
    return { allTokens, hiddenTokens };
  }, [checkAccountIsExist, fetchTokenList, networkId]);

  const [isLoading, setIsLoading] = useState(false);
  const onConfirm = useCallback(
    async (close?: () => void) => {
      setIsLoading(true);
      // Step1 -> Create Address
      const { hasExistAccountFlag, accountIdForNetwork } =
        await checkAccountIsExist();
      if (!hasExistAccountFlag) {
        throw new Error('Account not exist');
      }
      const values = form.getValues();
      const { contractAddress, symbol, decimals } = values;
      if (!contractAddress && !token?.isNative) {
        setIsLoading(false);
        throw new Error('Contract address is empty');
      }
      if (!symbol) {
        setIsLoading(false);
        throw new Error('Symbol is empty');
      }
      if (!new BigNumber(decimals).isInteger()) {
        setIsLoading(false);
        throw new Error('Decimals is invalid');
      }
      let tokenList = existTokenList?.allTokens;
      if (!tokenListFetchFinishedRef.current) {
        tokenList = await fetchTokenList({ accountId: accountIdForNetwork });
      }
      const tokenWithoutHidden = tokenList?.data.filter(
        (t) =>
          !existTokenList?.hiddenTokens.find(
            (hideToken) =>
              t.address.toLowerCase() === hideToken.address.toLowerCase(),
          ),
      );
      if (
        tokenWithoutHidden?.find(
          (t) => t.address.toLowerCase() === contractAddress.toLowerCase(),
        )
      ) {
        setIsLoading(false);
        Toast.error({
          title: 'Token already exists',
        });
        return;
      }
      await backgroundApiProxy.serviceCustomToken.addCustomToken({
        token: {
          address: contractAddress,
          symbol,
          decimals: new BigNumber(decimals).toNumber(),
          ...searchedTokenRef.current,
          accountId: accountIdForNetwork,
          networkId,
          name: searchedTokenRef.current?.name ?? '',
          isNative: searchedTokenRef.current?.isNative ?? false,
          $key: `${networkId}_${contractAddress}`,
        },
      });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.address_book_add_address_toast_add_success,
        }),
      });
      setTimeout(() => {
        onSuccess?.();
        close?.();
        setIsLoading(false);
      }, 300);
    },
    [
      form,
      checkAccountIsExist,
      fetchTokenList,
      existTokenList,
      networkId,
      token?.isNative,
      intl,
      onSuccess,
    ],
  );

  return (
    <Page>
      <Page.Header title="Custom Token" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
            disabled
          >
            <ControlledNetworkSelectorTrigger networkIds={[networkId]} />
          </Form.Field>
          <Form.Field label="Contract Address" name="contractAddress">
            <Input editable={!token?.isNative} />
          </Form.Field>
          <Form.Field label="Symbol" name="symbol">
            <Input editable={false} />
          </Form.Field>
          <Form.Field label="Decimals" name="decimals">
            <Input editable={false} />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText="Add"
        onConfirm={onConfirm}
        confirmButtonProps={{
          loading: isLoading,
        }}
      >
        {/* <AccountSelectorCreateAddressButton
          num={0}
          account={{
            walletId,
            indexedAccountId,
            networkId,
            deriveType,
          }}
        /> */}
      </Page.Footer>
    </Page>
  );
}

export default AddCustomTokenModal;
