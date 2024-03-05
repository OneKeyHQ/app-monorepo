import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToAnotherAccountAddressAtom,
} from '../../../states/jotai/contexts/swap';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export function useSwapFromAccountNetworkSync() {
  const { updateSelectedAccount } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [swapToAnotherAccount, setSwapToAnotherAccount] =
    useSwapToAnotherAccountAddressAtom();
  const [, setSettings] = useSettingsPersistAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const fromTokenRef = useRef<ISwapToken | undefined>();
  const toTokenRef = useRef<ISwapToken | undefined>();
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }

  const checkTokenForAccountNetwork = useCallback(() => {
    if (fromTokenRef.current) {
      void updateSelectedAccount({
        num: 0,
        builder: (v) => ({
          ...v,
          networkId: fromTokenRef.current?.networkId,
        }),
      });
    }
    if (toTokenRef.current) {
      void updateSelectedAccount({
        num: 1,
        builder: (v) => ({
          ...v,
          networkId: toTokenRef.current?.networkId,
        }),
      });
      if (toTokenRef.current?.networkId !== swapToAnotherAccount.networkId) {
        void setSwapToAnotherAccount((v) => ({
          ...v,
          address: undefined,
        }));
        void setSettings((v) => ({
          ...v,
          swapToAnotherAccountSwitchOn: false,
        }));
      }
    }
  }, [
    setSettings,
    setSwapToAnotherAccount,
    swapToAnotherAccount.networkId,
    updateSelectedAccount,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHideByModal: boolean) => {
      if (isHideByModal) return;
      if (isFocus) {
        checkTokenForAccountNetwork();
      }
    },
  );

  useEffect(() => {
    checkTokenForAccountNetwork();
  }, [checkTokenForAccountNetwork, fromToken, toToken]);
}

export function useSwapAddressInfo(type: ESwapDirectionType) {
  const { activeAccount } = useActiveAccount({
    num: type === ESwapDirectionType.FROM ? 0 : 1,
  });
  const [swapToAnotherAccountAddressAtom] =
    useSwapToAnotherAccountAddressAtom();
  const addressInfo = useMemo(() => {
    let res: {
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
      swapToAnotherAccountAddressAtom.address &&
      swapToAnotherAccountAddressAtom.networkId
    )
      res = {
        ...res,
        address: swapToAnotherAccountAddressAtom.address,
        networkId: swapToAnotherAccountAddressAtom.networkId,
        accountInfo: swapToAnotherAccountAddressAtom.accountInfo,
      };
    if (activeAccount) {
      res = {
        ...res,
        address: activeAccount.account?.address,
        networkId: activeAccount.network?.id,
        accountInfo: activeAccount,
      };
    }
    return res;
  }, [activeAccount, swapToAnotherAccountAddressAtom, type]);
  return addressInfo;
}
