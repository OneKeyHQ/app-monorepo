import { useCallback, useEffect, useMemo, useRef } from 'react';

import { debounce } from 'lodash';

import { EPageType, usePageType } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToAnotherAccountAddressAtom,
} from '../../../states/jotai/contexts/swap';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export function useSwapFromAccountNetworkSync() {
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const { activeAccount: toActiveAccount } = useActiveAccount({
    num: 1,
  });
  const { activeAccount: fromActiveAccount } = useActiveAccount({ num: 0 });
  const [swapToAnotherAccount, setSwapToAnotherAccount] =
    useSwapToAnotherAccountAddressAtom();
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [, setSettings] = useSettingsAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const fromTokenRef = useRef<ISwapToken | undefined>();
  const toTokenRef = useRef<ISwapToken | undefined>();
  const swapProviderSupportReceiveAddressRef = useRef<boolean | undefined>();
  const swapToAnotherAccountRef = useRef(swapToAnotherAccount);
  const swapToAccountRef = useRef(toActiveAccount);
  const swapFromAccountRef = useRef(fromActiveAccount);
  if (swapToAccountRef.current !== toActiveAccount) {
    swapToAccountRef.current = toActiveAccount;
  }
  if (swapFromAccountRef.current !== fromActiveAccount) {
    swapFromAccountRef.current = fromActiveAccount;
  }

  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }
  if (swapToAnotherAccountRef.current !== swapToAnotherAccount) {
    swapToAnotherAccountRef.current = swapToAnotherAccount;
  }
  if (
    swapProviderSupportReceiveAddressRef.current !==
    swapProviderSupportReceiveAddress
  ) {
    swapProviderSupportReceiveAddressRef.current =
      swapProviderSupportReceiveAddress;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkTokenForAccountNetworkDebounce = useCallback(
    debounce(async () => {
      if (fromTokenRef.current) {
        await updateSelectedAccountNetwork({
          num: 0,
          networkId: fromTokenRef.current?.networkId,
        });
      }
      if (toTokenRef.current) {
        await updateSelectedAccountNetwork({
          num: 1,
          networkId: toTokenRef.current?.networkId,
        });
      }
      if (fromTokenRef.current && toTokenRef.current) {
        if (
          // The selected toToken network is not the same as the current account network and needs to be reset
          (swapToAnotherAccountRef.current?.networkId &&
            toTokenRef.current?.networkId !==
              swapToAnotherAccountRef.current?.networkId) ||
          // The account is empty and needs to be reset
          (!swapToAnotherAccountRef.current?.networkId &&
            !swapToAccountRef.current?.account &&
            swapToAccountRef.current?.wallet) ||
          // Does not support sending to a different address of the channel provider, need to reset
          swapProviderSupportReceiveAddressRef.current === false ||
          // Select to account, but no confirmation, return to the swap page needs to reset
          (!swapToAnotherAccountRef.current.address &&
            swapToAccountRef.current.account?.id !==
              swapFromAccountRef.current.account?.id)
        ) {
          setSettings((v) => ({
            ...v,
            swapToAnotherAccountSwitchOn: false,
          }));
          setSwapToAnotherAccount((v) => ({ ...v, address: undefined }));
          // should wait account async finish
          setTimeout(() => {
            if (
              toTokenRef.current?.networkId &&
              swapToAccountRef.current.network?.id &&
              toTokenRef.current?.networkId !==
                swapToAccountRef.current.network.id
            )
              void updateSelectedAccountNetwork({
                num: 1,
                networkId: toTokenRef.current?.networkId,
              });
          }, 500);
        }
      }
    }, 100),
    [setSettings, updateSelectedAccountNetwork],
  );

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    async (isFocus: boolean, isHideByModal: boolean) => {
      if (pageType !== EPageType.modal) {
        if (isHideByModal) return;
        if (isFocus) {
          await checkTokenForAccountNetworkDebounce();
        }
      }
    },
  );

  useEffect(() => {
    if (pageType !== EPageType.modal) {
      void (async () => {
        await checkTokenForAccountNetworkDebounce();
      })();
    }
  }, [
    checkTokenForAccountNetworkDebounce,
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    swapProviderSupportReceiveAddress,
    pageType,
  ]);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (isFocused) {
        void (async () => {
          await checkTokenForAccountNetworkDebounce();
        })();
      }
    }
  }, [
    checkTokenForAccountNetworkDebounce,
    isFocused,
    pageType,
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    swapProviderSupportReceiveAddress,
  ]);
}

export function useSwapAddressInfo(type: ESwapDirectionType) {
  const { activeAccount } = useActiveAccount({
    num: type === ESwapDirectionType.FROM ? 0 : 1,
  });
  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  const [swapToAnotherAccountAddressAtom] =
    useSwapToAnotherAccountAddressAtom();
  const addressInfo = useMemo(() => {
    const res: {
      address: undefined | string;
      networkId: undefined | string;
      accountInfo: IAccountSelectorActiveAccountInfo | undefined;
      activeAccount: IAccountSelectorActiveAccountInfo | undefined;
    } = {
      networkId: undefined,
      address: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
    };

    if (
      type === ESwapDirectionType.TO &&
      swapToAnotherAccountSwitchOn &&
      swapToAnotherAccountAddressAtom.address &&
      swapToAnotherAccountAddressAtom.networkId &&
      activeAccount &&
      activeAccount.network?.id === swapToAnotherAccountAddressAtom.networkId
    ) {
      return {
        ...res,
        address: swapToAnotherAccountAddressAtom.address,
        networkId: swapToAnotherAccountAddressAtom.networkId,
        accountInfo: swapToAnotherAccountAddressAtom.accountInfo,
        activeAccount: { ...activeAccount },
      };
    }
    if (activeAccount) {
      return {
        ...res,
        address: activeAccount.account?.address,
        networkId: activeAccount.network?.id,
        accountInfo: { ...activeAccount },
        activeAccount: { ...activeAccount },
      };
    }
    return res;
  }, [
    type,
    swapToAnotherAccountSwitchOn,
    swapToAnotherAccountAddressAtom,
    activeAccount,
  ]);
  return addressInfo;
}

export function useSwapRecipientAddressInfo(enable: boolean) {
  const fromAccountInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  const [swapToAnotherAddressInfo] = useSwapToAnotherAccountAddressAtom();
  const getToNetWorkAddressFromAccountId = usePromiseResult(
    async () => {
      if (!enable) {
        return null;
      }
      if (
        swapToAddressInfo.networkId &&
        fromAccountInfo.accountInfo?.account?.id &&
        fromAccountInfo.accountInfo?.indexedAccount?.id
      ) {
        const accountInfos =
          await backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId: fromAccountInfo.accountInfo?.account?.id,
            networkId: swapToAddressInfo.networkId,
            indexedAccountId: fromAccountInfo.accountInfo?.indexedAccount?.id,
          });
        return accountInfos;
      }
    },
    [
      enable,
      swapToAddressInfo.networkId,
      fromAccountInfo.accountInfo?.account?.id,
      fromAccountInfo.accountInfo?.indexedAccount?.id,
    ],
    {},
  );

  const getToAddressAccountInfos = usePromiseResult(
    async () => {
      if (
        swapToAnotherAddressInfo.networkId &&
        swapToAnotherAddressInfo.address
      ) {
        const res =
          await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
            networkId: swapToAnotherAddressInfo.networkId,
            address: swapToAnotherAddressInfo.address,
          });
        if (res.length > 0) {
          return res[0];
        }
      }
    },
    [swapToAnotherAddressInfo.address, swapToAnotherAddressInfo.networkId],
    {},
  );
  if (
    swapToAddressInfo.address === swapToAnotherAddressInfo.address &&
    swapToAnotherAccountSwitchOn
  ) {
    if (
      getToNetWorkAddressFromAccountId?.result?.accountAddress &&
      getToNetWorkAddressFromAccountId?.result?.accountAddress !==
        swapToAnotherAddressInfo.address &&
      swapToAnotherAddressInfo.networkId ===
        currentQuoteRes?.toTokenInfo.networkId
    ) {
      return {
        accountInfo:
          swapToAnotherAddressInfo.accountInfo?.account?.address ===
          swapToAnotherAddressInfo.address
            ? {
                walletName: swapToAnotherAddressInfo.accountInfo?.wallet?.name,
                accountName: swapToAnotherAddressInfo.accountInfo?.accountName,
                accountId: swapToAnotherAddressInfo.accountInfo?.account?.id,
              }
            : getToAddressAccountInfos.result,
        showAddress: accountUtils.shortenAddress({
          address: swapToAnotherAddressInfo.address,
          leadingLength: 6,
          trailingLength: 6,
        }),
        isExtAccount:
          swapToAnotherAddressInfo.accountInfo?.account?.address !==
            swapToAnotherAddressInfo.address &&
          !getToAddressAccountInfos.result,
      };
    }
  }
}
