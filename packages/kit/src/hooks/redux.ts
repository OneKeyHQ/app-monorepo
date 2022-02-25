import { useCallback, useMemo } from 'react';

import { TypedUseSelectorHook, useSelector } from 'react-redux';

import type { Account } from '@onekeyhq/engine/src/types/account';
import { Token } from '@onekeyhq/engine/src/types/token';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import engine from '../engine/EngineProvider';
import { appDispatch, appSelector } from '../store';
import {
  ValuedToken,
  changeActiveOwnedToken,
  changeActiveTokens,
} from '../store/reducers/general';

import type { IAppState } from '../store';
import type { Network } from '../store/reducers/network';

export const useAppDispatch = () => appDispatch;
export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;

export type ISelectorBuilder = (selector: typeof useAppSelector) => unknown;

export function makeSelector<T>(builder: ISelectorBuilder) {
  return {
    // hooks for UI
    use: (): T => builder(useAppSelector) as T,
    // getter for Background
    get: (): T => builder(appSelector) as T,
  };
}

export const useSettings = () => {
  const settings = useAppSelector((s) => s.settings);
  return settings;
};

export const useStatus = () => {
  const status = useAppSelector((s) => s.status);
  return status;
};

export const useGeneral = () => {
  const general = useAppSelector((s) => s.general);
  return general;
};

export type IActiveWalletAccount = {
  wallet: Wallet | null;
  account: Account | null;
  network: {
    network: Network;
    sharedChainName: string;
  } | null;
};

export const useManageTokens = () => {
  const { activeAccount, activeNetwork, tokens, ownedTokens } = useAppSelector(
    (s) => s.general,
  );
  const dispatch = useAppDispatch();

  const { allTokens } = useMemo(() => {
    let allListData: Token[] = [];
    if (activeAccount && activeNetwork) {
      allListData =
        tokens[activeAccount?.id]?.[activeNetwork?.network.id] ?? [];
    }
    return { allTokens: allListData };
  }, [tokens, activeAccount, activeNetwork]);

  const { accountTokens, accountTokensSet } = useMemo(() => {
    let myListData: ValuedToken[] = [];
    const mySetData = new Set<string>();
    if (activeAccount && activeNetwork) {
      myListData =
        ownedTokens[activeAccount?.id]?.[activeNetwork?.network.id] ?? [];
    }
    myListData.forEach((token) => {
      if (token.tokenIdOnNetwork) {
        mySetData.add(token.tokenIdOnNetwork);
      }
    });
    return { accountTokens: myListData, accountTokensSet: mySetData };
  }, [ownedTokens, activeAccount, activeNetwork]);

  const updateAccountTokens = useCallback(() => {
    if (activeAccount && activeNetwork) {
      engine
        .getTokens(activeNetwork.network.id, activeAccount.id)
        .then((dataList) => {
          const list = dataList;
          if (accountTokens.length === 0) {
            dispatch(
              changeActiveOwnedToken(
                list.map((item) => ({ ...item, balance: '0' })),
              ),
            );
          }
          engine
            .getAccountBalance(
              activeAccount.id,
              activeNetwork.network.id,
              list
                .filter((i) => i.tokenIdOnNetwork)
                .map((token) => token.tokenIdOnNetwork),
              true,
            )
            .then((balanceData) => {
              const listWithBalances = list.map((item) => {
                const data = {
                  ...item,
                  balance: item.tokenIdOnNetwork
                    ? balanceData[item.tokenIdOnNetwork]?.toString()
                    : balanceData.main?.toString(),
                };
                return data;
              });
              dispatch(changeActiveOwnedToken(listWithBalances));
            });
        });
    }
  }, [activeAccount, activeNetwork, dispatch, accountTokens.length]);

  const updateTokens = useCallback(() => {
    if (activeAccount && activeNetwork) {
      dispatch(
        changeActiveTokens(
          engine.getTopTokensOnNetwork(activeNetwork.network.id, 50),
        ),
      );
    }
  }, [activeAccount, activeNetwork, dispatch]);

  return {
    accountTokensSet,
    accountTokens,
    allTokens,
    updateTokens,
    updateAccountTokens,
  };
};

export const { use: useActiveWalletAccount, get: getActiveWalletAccount } =
  makeSelector<IActiveWalletAccount>((selector) => {
    const { activeAccount, activeWallet, activeNetwork } = selector(
      (s) => s.general,
    );

    return {
      wallet: activeWallet,
      account: activeAccount,
      network: activeNetwork,
    };
  });
