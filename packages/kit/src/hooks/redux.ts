import { useCallback, useMemo } from 'react';

import { TypedUseSelectorHook, useSelector } from 'react-redux';

import { Token } from '@onekeyhq/engine/src/types/token';

import engine from '../engine/EngineProvider';
import { appDispatch } from '../store';
import {
  MyToken,
  changeActiveOwnedToken,
  changeActiveTokens,
} from '../store/reducers/general';

import type { IAppState } from '../store';

export const useAppDispatch = () => appDispatch;
export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;

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

export const useActiveWalletAccount = () => {
  const { activeAccount, activeWallet, activeNetwork } = useAppSelector(
    (s) => s.general,
  );

  return {
    wallet: activeWallet,
    account: activeAccount,
    network: activeNetwork,
  };
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
    let myListData: MyToken[] = [];
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
          if (accountTokens.length === 0) {
            dispatch(
              changeActiveOwnedToken(
                dataList.map((item) => ({ ...item, balance: '0' })),
              ),
            );
          }
          engine
            .getAccountBalance(
              activeAccount.id,
              activeNetwork.network.id,
              dataList.map((token) => token.tokenIdOnNetwork),
              true,
            )
            .then((balanceData) => {
              const listWithBalances = dataList.map((item) => {
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
      engine.getTokens(activeNetwork.network.id).then((res) => {
        dispatch(changeActiveTokens(res.slice(0, 50)));
      });
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
