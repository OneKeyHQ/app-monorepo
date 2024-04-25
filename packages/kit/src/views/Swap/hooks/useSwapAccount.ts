import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { debounce } from 'lodash';

import { EPageType, usePageType } from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToAnotherAccountAddressAtom,
} from '../../../states/jotai/contexts/swap';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export function useSwapFromAccountNetworkSync() {
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [swapToAnotherAccount] = useSwapToAnotherAccountAddressAtom();
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [, setSettings] = useSettingsAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const fromTokenRef = useRef<ISwapToken | undefined>();
  const toTokenRef = useRef<ISwapToken | undefined>();
  const swapProviderSupportReceiveAddressRef = useRef<boolean | undefined>();
  const swapToAnotherAccountRef = useRef(swapToAnotherAccount);
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
      if (
        (fromTokenRef.current &&
          toTokenRef.current &&
          toTokenRef.current?.networkId !==
            swapToAnotherAccountRef.current.networkId) ||
        swapProviderSupportReceiveAddressRef.current === false
      ) {
        setSettings((v) => ({
          ...v,
          swapToAnotherAccountSwitchOn: false,
        }));
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

  const isFocused = useIsFocused();
  useEffect(() => {
    void (async () => {
      if (pageType === EPageType.modal && isFocused) {
        await checkTokenForAccountNetworkDebounce();
      }
    })();
  }, [
    checkTokenForAccountNetworkDebounce,
    fromToken,
    toToken,
    swapProviderSupportReceiveAddress,
    isFocused,
    pageType,
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
    } = {
      networkId: undefined,
      address: undefined,
      accountInfo: undefined,
    };
    if (
      type === ESwapDirectionType.TO &&
      swapToAnotherAccountSwitchOn &&
      swapToAnotherAccountAddressAtom.address &&
      swapToAnotherAccountAddressAtom.networkId
    ) {
      return {
        ...res,
        address: swapToAnotherAccountAddressAtom.address,
        networkId: swapToAnotherAccountAddressAtom.networkId,
        accountInfo: swapToAnotherAccountAddressAtom.accountInfo,
      };
    }
    if (activeAccount) {
      return {
        ...res,
        address: activeAccount.account?.address,
        networkId: activeAccount.network?.id,
        accountInfo: { ...activeAccount },
      };
    }
    return res;
  }, [
    activeAccount,
    swapToAnotherAccountSwitchOn,
    swapToAnotherAccountAddressAtom.accountInfo,
    swapToAnotherAccountAddressAtom.address,
    swapToAnotherAccountAddressAtom.networkId,
    type,
  ]);
  return addressInfo;
}
