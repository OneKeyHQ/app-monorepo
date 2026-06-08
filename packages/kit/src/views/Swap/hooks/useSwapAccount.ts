import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapToAnotherAccountAddressAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  buildSwapSelectedTokensColdStartContext,
  isSwapSelectedTokensColdStartContextMatched,
} from '../utils/swapColdStartTokenCacheUtils';

import {
  shouldShowSwapRecipientAddressInfo,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

/**
 * Synchronizes the selected swap account networks with the currently selected swap tokens and manages the "swap to another account" state.
 *
 * Ensures that the account network selection matches the chosen swap tokens for both "from" and "to" directions. Automatically resets the "swap to another account" switch and address if the selected network or account becomes invalid or unsupported. Triggers synchronization on relevant changes, tab focus, and modal state transitions.
 */
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
  const [selectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const isSelectedTokensColdStartContextValid = useMemo(() => {
    if (!fromToken && !toToken) {
      return true;
    }
    if (!selectedTokensColdStartContext) {
      return true;
    }

    const currentContext = buildSwapSelectedTokensColdStartContext({
      activeAccount: fromActiveAccount,
      networkId: fromActiveAccount.network?.id,
    });
    if (!currentContext) {
      return false;
    }

    return isSwapSelectedTokensColdStartContextMatched({
      cachedContext: selectedTokensColdStartContext,
      currentContext,
    });
  }, [fromToken, fromActiveAccount, selectedTokensColdStartContext, toToken]);
  const fromTokenRef = useRef<ISwapToken | undefined>(undefined);
  const toTokenRef = useRef<ISwapToken | undefined>(undefined);
  const isSelectedTokensColdStartContextValidRef = useRef(
    isSelectedTokensColdStartContextValid,
  );
  const swapProviderSupportReceiveAddressRef = useRef<boolean | undefined>(
    undefined,
  );
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
  if (
    isSelectedTokensColdStartContextValidRef.current !==
    isSelectedTokensColdStartContextValid
  ) {
    isSelectedTokensColdStartContextValidRef.current =
      isSelectedTokensColdStartContextValid;
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
      if (!isSelectedTokensColdStartContextValidRef.current) {
        return;
      }
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

  const isModalPage = useIsOverlayPage();
  useListenTabFocusState(
    ETabRoutes.Swap,
    async (isFocus: boolean, isHideByModal: boolean) => {
      if (!isModalPage) {
        if (isHideByModal) return;
        if (isFocus) {
          await checkTokenForAccountNetworkDebounce();
        }
      }
    },
  );

  useEffect(() => {
    if (!isModalPage) {
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
    isSelectedTokensColdStartContextValid,
    swapProviderSupportReceiveAddress,
    isModalPage,
  ]);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isModalPage) {
      if (isFocused) {
        void (async () => {
          await checkTokenForAccountNetworkDebounce();
        })();
      }
    }
  }, [
    checkTokenForAccountNetworkDebounce,
    isFocused,
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    isSelectedTokensColdStartContextValid,
    swapProviderSupportReceiveAddress,
    isModalPage,
  ]);
}

export function useSwapAddressInfo(type: ESwapDirectionType) {
  const { activeAccount } = useActiveAccount({
    num: type === ESwapDirectionType.FROM ? 0 : 1,
  });
  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToToken] = useSwapProSellToTokenAtom();
  const [accountForTargetNetwork, setAccountForTargetNetwork] = useState<
    INetworkAccount | undefined
  >(undefined);
  const [resolvedTargetNetworkAccountKey, setResolvedTargetNetworkAccountKey] =
    useState<string | undefined>(undefined);

  const focusSwapPro = useMemo(() => {
    return (
      platformEnv.isNative && swapTabSwitchType === ESwapTabSwitchType.LIMIT
    );
  }, [swapTabSwitchType]);

  const isAllNetwork = useMemo(() => {
    return networkUtils.isAllNetwork({
      networkId: activeAccount.network?.id,
    });
  }, [activeAccount.network?.id]);

  const tokenNetworkId = useMemo(() => {
    if (focusSwapPro) {
      return type === ESwapDirectionType.FROM
        ? ((swapProDirection === ESwapDirection.BUY
            ? swapProUseSelectBuyToken
            : swapProSelectToken
          )?.networkId ?? '')
        : ((swapProDirection === ESwapDirection.BUY
            ? swapProSelectToken
            : swapProSellToToken
          )?.networkId ?? '');
    }
    return type === ESwapDirectionType.FROM
      ? (currentSelectNetwork?.networkId ?? fromToken?.networkId ?? '')
      : (currentSelectNetwork?.networkId ?? toToken?.networkId ?? '');
  }, [
    focusSwapPro,
    type,
    fromToken?.networkId,
    toToken?.networkId,
    currentSelectNetwork?.networkId,
    swapProDirection,
    swapProSelectToken,
    swapProUseSelectBuyToken,
    swapProSellToToken,
  ]);

  const shouldResolveTargetNetworkAccount = useMemo(() => {
    if (!tokenNetworkId || !activeAccount.ready) {
      return false;
    }

    if (!activeAccount.indexedAccount?.id && !activeAccount.account?.id) {
      return false;
    }

    if (isAllNetwork) {
      return true;
    }

    return activeAccount.network?.id !== tokenNetworkId;
  }, [
    activeAccount.account?.id,
    activeAccount.indexedAccount?.id,
    activeAccount.network?.id,
    activeAccount.ready,
    isAllNetwork,
    tokenNetworkId,
  ]);

  const targetNetworkAccountResolveKey = useMemo(() => {
    if (!shouldResolveTargetNetworkAccount || !tokenNetworkId) {
      return undefined;
    }
    return [
      tokenNetworkId,
      activeAccount.indexedAccount?.id ?? '',
      activeAccount.account?.id ?? '',
      activeAccount.deriveType ?? '',
    ].join('|');
  }, [
    activeAccount.account?.id,
    activeAccount.deriveType,
    activeAccount.indexedAccount?.id,
    shouldResolveTargetNetworkAccount,
    tokenNetworkId,
  ]);

  const isAddressInfoReady = useMemo(() => {
    if (!activeAccount.ready) {
      return false;
    }
    if (!targetNetworkAccountResolveKey) {
      return true;
    }
    return resolvedTargetNetworkAccountKey === targetNetworkAccountResolveKey;
  }, [
    activeAccount.ready,
    resolvedTargetNetworkAccountKey,
    targetNetworkAccountResolveKey,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!shouldResolveTargetNetworkAccount || !tokenNetworkId) {
      setAccountForTargetNetwork(undefined);
      setResolvedTargetNetworkAccountKey(undefined);
      return;
    }
    setResolvedTargetNetworkAccountKey(undefined);

    void (async () => {
      try {
        const targetDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: tokenNetworkId,
          });
        const targetAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            deriveType: targetDeriveType,
            indexedAccountId: activeAccount.indexedAccount?.id,
            accountId: activeAccount.indexedAccount?.id
              ? undefined
              : activeAccount.account?.id,
            dbAccount: activeAccount.dbAccount,
            networkId: tokenNetworkId,
          });
        if (!cancelled) {
          setAccountForTargetNetwork(targetAccount);
          setResolvedTargetNetworkAccountKey(targetNetworkAccountResolveKey);
        }
      } catch (_e) {
        if (!cancelled) {
          setAccountForTargetNetwork(undefined);
          setResolvedTargetNetworkAccountKey(targetNetworkAccountResolveKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAccount.account?.id,
    activeAccount.dbAccount,
    activeAccount.indexedAccount?.id,
    shouldResolveTargetNetworkAccount,
    targetNetworkAccountResolveKey,
    tokenNetworkId,
  ]);

  const [swapToAnotherAccountAddressAtom] =
    useSwapToAnotherAccountAddressAtom();
  const addressInfo = useMemo(() => {
    const res: {
      address: undefined | string;
      networkId: undefined | string;
      accountInfo: IAccountSelectorActiveAccountInfo | undefined;
      activeAccount: IAccountSelectorActiveAccountInfo | undefined;
      isAddressInfoReady: boolean;
    } = {
      networkId: undefined,
      address: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
      isAddressInfoReady,
    };
    // Keep the confirmed custom recipient even when cross-chain TO account
    // resolution has not materialized a network account yet.
    if (
      shouldUseSwapCustomRecipientAddress({
        type,
        swapToAnotherAccountSwitchOn,
        selectedRecipientAddress: swapToAnotherAccountAddressAtom.address,
        selectedRecipientNetworkId: swapToAnotherAccountAddressAtom.networkId,
        activeNetworkId: activeAccount.network?.id,
        tokenNetworkId,
        isAllNetwork,
      })
    ) {
      return {
        ...res,
        address: swapToAnotherAccountAddressAtom.address ?? '',
        networkId: swapToAnotherAccountAddressAtom.networkId ?? '',
        isAddressInfoReady: true,
        accountInfo: swapToAnotherAccountAddressAtom.accountInfo
          ? {
              ...swapToAnotherAccountAddressAtom.accountInfo,
            }
          : undefined,
        activeAccount: {
          ...activeAccount,
        },
      };
    }

    const resolvedAccount = shouldResolveTargetNetworkAccount
      ? accountForTargetNetwork
      : activeAccount.account;

    if (activeAccount) {
      return {
        ...res,
        address: resolvedAccount?.addressDetail?.address,
        // Keep the token network and the resolved account aligned so the
        // inline recipient badge matches the modal parser result.
        networkId: tokenNetworkId || activeAccount.network?.id,
        activeAccount: {
          ...activeAccount,
          ...(resolvedAccount
            ? {
                account: {
                  ...resolvedAccount,
                },
              }
            : undefined),
        },
        accountInfo: {
          ...activeAccount,
          ...(resolvedAccount
            ? {
                account: {
                  ...resolvedAccount,
                },
              }
            : undefined),
        },
      };
    }
    if (
      isAllNetwork &&
      accountForTargetNetwork?.networks?.includes(tokenNetworkId)
    ) {
      return {
        ...res,
        address: accountForTargetNetwork?.addressDetail?.address,
        networkId: tokenNetworkId,
        isAddressInfoReady,
      };
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type,
    swapToAnotherAccountSwitchOn,
    swapToAnotherAccountAddressAtom.address,
    swapToAnotherAccountAddressAtom.networkId,
    swapToAnotherAccountAddressAtom.accountInfo,
    activeAccount,
    isAllNetwork,
    accountForTargetNetwork,
    isAddressInfoReady,
    tokenNetworkId,
    currentSelectNetwork?.networkId,
    shouldResolveTargetNetworkAccount,
  ]);
  return addressInfo;
}

export function useSwapRecipientAddressInfo(enable: boolean) {
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [toToken] = useSwapSelectToTokenAtom();
  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  const [swapToAnotherAddressInfo] = useSwapToAnotherAccountAddressAtom();

  const getToAddressAccountInfos = usePromiseResult(
    async () => {
      if (!enable) {
        return undefined;
      }

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
    [
      enable,
      swapToAnotherAddressInfo.address,
      swapToAnotherAddressInfo.networkId,
    ],
    {},
  );

  if (
    enable &&
    shouldShowSwapRecipientAddressInfo({
      swapToAnotherAccountSwitchOn,
      selectedRecipientAddress: swapToAnotherAddressInfo.address,
      selectedRecipientNetworkId: swapToAnotherAddressInfo.networkId,
      toTokenNetworkId: toToken?.networkId,
      toAddressNetworkId: swapToAddressInfo.networkId,
    })
  ) {
    const isRecipientExternalAccount =
      swapToAnotherAddressInfo.accountInfo?.account?.address !==
        swapToAnotherAddressInfo.address && !getToAddressAccountInfos.result;

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
      isExtAccount: isRecipientExternalAccount,
    };
  }
}
