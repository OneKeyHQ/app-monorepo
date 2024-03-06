import { useCallback, useEffect, useMemo, useRef } from 'react';

import { debounce } from 'lodash';

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
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [swapToAnotherAccount, setSwapToAnotherAccount] =
    useSwapToAnotherAccountAddressAtom();
  const [, setSettings] = useSettingsPersistAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const fromTokenRef = useRef<ISwapToken | undefined>();
  const toTokenRef = useRef<ISwapToken | undefined>();
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
        fromTokenRef.current &&
        toTokenRef.current &&
        toTokenRef.current?.networkId !==
          swapToAnotherAccountRef.current.networkId
      ) {
        setSettings((v) => ({
          ...v,
          swapToAnotherAccountSwitchOn: false,
        }));
        setSwapToAnotherAccount((v) => ({
          ...v,
          networkId: toTokenRef.current?.networkId,
        }));
      }
    }, 100),
    [setSettings, updateSelectedAccountNetwork],
  );

  useListenTabFocusState(
    ETabRoutes.Swap,
    async (isFocus: boolean, isHideByModal: boolean) => {
      if (isHideByModal) return;
      if (isFocus) {
        await checkTokenForAccountNetworkDebounce();
      }
    },
  );

  useEffect(() => {
    void (async () => {
      await checkTokenForAccountNetworkDebounce();
    })();
  }, [checkTokenForAccountNetworkDebounce, fromToken, toToken]);
}

export function useSwapAddressInfo(type: ESwapDirectionType) {
  const { activeAccount } = useActiveAccount({
    num: type === ESwapDirectionType.FROM ? 0 : 1,
  });
  const [settingsPersistAtom] = useSettingsPersistAtom();
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
      settingsPersistAtom.swapToAnotherAccountSwitchOn &&
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
        accountInfo: { ...activeAccount },
      };
    }
    return res;
  }, [
    activeAccount,
    settingsPersistAtom.swapToAnotherAccountSwitchOn,
    swapToAnotherAccountAddressAtom.accountInfo,
    swapToAnotherAccountAddressAtom.address,
    swapToAnotherAccountAddressAtom.networkId,
    type,
  ]);
  return addressInfo;
}
