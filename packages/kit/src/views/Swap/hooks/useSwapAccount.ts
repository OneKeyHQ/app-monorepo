import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import {
  useSwapFromTokenAmountAtom,
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
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  isSwapSelectedTokensColdStartContextValidForAccountNetworkSync,
  shouldPreserveSwapUserInputOnAccountSwitch,
} from '../utils/swapColdStartTokenCacheUtils';

import {
  type ISwapTargetNetworkAccountRequestState,
  buildSwapTargetNetworkAccountResolutionPlan,
  getSwapTargetNetworkAccountResolution,
  resolveSwapTargetNetworkAccount,
} from './swapTargetNetworkAccountResolver';
import {
  getSwapAddressAccountSelectorNum,
  shouldResetSwapRecipientOnAccountNetworkSync,
  shouldShowSwapRecipientAddressInfo,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

const SWAP_TARGET_NETWORK_ACCOUNT_AUTO_RETRY_LIMIT = 2;
const SWAP_TARGET_NETWORK_ACCOUNT_AUTO_RETRY_BASE_DELAY_MS = 1000;

function isSameSwapRecipientAddress({
  address,
  targetAddress,
}: {
  address?: string;
  targetAddress?: string;
}) {
  if (!address || !targetAddress) {
    return false;
  }
  return address.toLowerCase() === targetAddress.toLowerCase();
}

/**
 * Synchronizes the selected swap account networks with the currently selected swap tokens and manages the "swap to another account" state.
 *
 * Ensures that the account network selection matches the chosen swap tokens for both "from" and "to" directions. Automatically resets the "swap to another account" switch and address if the selected network or account becomes invalid or unsupported. Triggers synchronization on relevant changes, tab focus, and modal state transitions.
 */
export function useSwapFromAccountNetworkSync() {
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
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
  const shouldPreserveSelectedTokensForAccountNetworkSync = useMemo(
    () =>
      shouldPreserveSwapUserInputOnAccountSwitch({
        fromTokenAmount,
        hasSelectedTokens: Boolean(fromToken || toToken),
        toTokenAmount,
      }),
    [fromToken, fromTokenAmount, toToken, toTokenAmount],
  );
  const isSelectedTokensColdStartContextValid = useMemo(() => {
    return isSwapSelectedTokensColdStartContextValidForAccountNetworkSync({
      activeAccount: fromActiveAccount,
      fromToken,
      preserveSelectedTokens: shouldPreserveSelectedTokensForAccountNetworkSync,
      selectedTokensColdStartContext,
      toToken,
    });
  }, [
    fromToken,
    fromActiveAccount,
    selectedTokensColdStartContext,
    shouldPreserveSelectedTokensForAccountNetworkSync,
    toToken,
  ]);
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
          shouldResetSwapRecipientOnAccountNetworkSync({
            selectedRecipientAddress: swapToAnotherAccountRef.current.address,
            selectedRecipientNetworkId:
              swapToAnotherAccountRef.current?.networkId,
            hasTargetWallet: Boolean(swapToAccountRef.current?.wallet),
            targetAccountId: swapToAccountRef.current.account?.id,
            sourceAccountId: swapFromAccountRef.current.account?.id,
            providerSupportReceiveAddress:
              swapProviderSupportReceiveAddressRef.current,
          })
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
  const isRouteFocused = useIsFocused();
  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  const { activeAccount } = useActiveAccount({
    num: getSwapAddressAccountSelectorNum({
      type,
      swapToAnotherAccountSwitchOn,
    }),
  });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToToken] = useSwapProSellToTokenAtom();
  const [
    targetNetworkAccountRequestState,
    setTargetNetworkAccountRequestState,
  ] = useState<ISwapTargetNetworkAccountRequestState>({ status: 'idle' });
  const [
    targetNetworkAccountRetryRevision,
    setTargetNetworkAccountRetryRevision,
  ] = useState(0);

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

  const targetNetworkAccountResolutionPlan = useMemo(
    () =>
      buildSwapTargetNetworkAccountResolutionPlan({
        accountId: activeAccount.account?.id,
        activeAccountReady: activeAccount.ready,
        activeNetworkId: activeAccount.network?.id,
        deriveType: activeAccount.deriveType,
        indexedAccountId: activeAccount.indexedAccount?.id,
        isAllNetwork,
        tokenNetworkId,
      }),
    [
      activeAccount.account?.id,
      activeAccount.deriveType,
      activeAccount.indexedAccount?.id,
      activeAccount.network?.id,
      activeAccount.ready,
      isAllNetwork,
      tokenNetworkId,
    ],
  );
  const { key: targetNetworkAccountResolveKey } =
    targetNetworkAccountResolutionPlan;
  const targetNetworkAccountResolution = useMemo(
    () =>
      getSwapTargetNetworkAccountResolution({
        activeAccountReady: activeAccount.ready,
        requestState: targetNetworkAccountRequestState,
        targetKey: targetNetworkAccountResolveKey,
      }),
    [
      activeAccount.ready,
      targetNetworkAccountRequestState,
      targetNetworkAccountResolveKey,
    ],
  );
  const accountForTargetNetwork = targetNetworkAccountResolution.account;
  const isAddressInfoReady = targetNetworkAccountResolution.isAddressInfoReady;
  const shouldResolveTargetNetworkAccount =
    targetNetworkAccountResolutionPlan.shouldResolve;
  const targetNetworkAccountResolutionStatusRef = useRef(
    targetNetworkAccountResolution.status,
  );
  targetNetworkAccountResolutionStatusRef.current =
    targetNetworkAccountResolution.status;
  const targetNetworkAccountAutoRetryRef = useRef<{
    attempts: number;
    key?: string;
  }>({ attempts: 0 });
  if (
    targetNetworkAccountAutoRetryRef.current.key !==
    targetNetworkAccountResolveKey
  ) {
    targetNetworkAccountAutoRetryRef.current = {
      attempts: 0,
      key: targetNetworkAccountResolveKey,
    };
  }

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHideByModal: boolean) => {
      if (
        isFocus &&
        !isHideByModal &&
        targetNetworkAccountResolutionStatusRef.current === 'failed'
      ) {
        targetNetworkAccountAutoRetryRef.current.attempts = 0;
        setTargetNetworkAccountRetryRevision((revision) => revision + 1);
      }
    },
  );

  useEffect(() => {
    if (
      !isRouteFocused ||
      targetNetworkAccountResolution.status !== 'failed' ||
      !targetNetworkAccountResolveKey
    ) {
      return;
    }
    const retryState = targetNetworkAccountAutoRetryRef.current;
    if (
      retryState.key !== targetNetworkAccountResolveKey ||
      retryState.attempts >= SWAP_TARGET_NETWORK_ACCOUNT_AUTO_RETRY_LIMIT
    ) {
      return;
    }
    const delay =
      SWAP_TARGET_NETWORK_ACCOUNT_AUTO_RETRY_BASE_DELAY_MS *
      2 ** retryState.attempts;
    retryState.attempts += 1;
    const timer = setTimeout(() => {
      setTargetNetworkAccountRetryRevision((revision) => revision + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [
    isRouteFocused,
    targetNetworkAccountResolution.status,
    targetNetworkAccountResolveKey,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!shouldResolveTargetNetworkAccount || !tokenNetworkId) {
      setTargetNetworkAccountRequestState({ status: 'idle' });
      return;
    }
    const requestKey = targetNetworkAccountResolveKey;
    if (!requestKey) {
      return;
    }
    setTargetNetworkAccountRequestState({
      key: requestKey,
      status: 'pending',
    });

    void resolveSwapTargetNetworkAccount({
      key: requestKey,
      resolve: async () => {
        const targetDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: tokenNetworkId,
          });
        return backgroundApiProxy.serviceAccount.getNetworkAccount({
          deriveType: targetDeriveType,
          indexedAccountId: activeAccount.indexedAccount?.id,
          accountId: activeAccount.indexedAccount?.id
            ? undefined
            : activeAccount.account?.id,
          dbAccount: activeAccount.dbAccount,
          networkId: tokenNetworkId,
        });
      },
    }).then(
      (account) => {
        if (!cancelled) {
          setTargetNetworkAccountRequestState({
            account,
            key: requestKey,
            status: 'resolved',
          });
        }
      },
      () => {
        if (!cancelled) {
          setTargetNetworkAccountRequestState({
            key: requestKey,
            status: 'failed',
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    activeAccount.account?.id,
    activeAccount.dbAccount,
    activeAccount.indexedAccount?.id,
    shouldResolveTargetNetworkAccount,
    targetNetworkAccountRetryRevision,
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
      const recipientAddress = swapToAnotherAccountAddressAtom.address ?? '';
      const recipientNetworkId = swapToAnotherAccountAddressAtom.networkId;
      const targetRecipientNetworkId =
        tokenNetworkId || activeAccount.network?.id || recipientNetworkId || '';
      const savedRecipientAccountInfo =
        swapToAnotherAccountAddressAtom.accountInfo;
      const targetNetworkAccountMatchesRecipient = isSameSwapRecipientAddress({
        address: accountForTargetNetwork?.addressDetail?.address,
        targetAddress: recipientAddress,
      });
      const activeAccountMatchesRecipient = isSameSwapRecipientAddress({
        address: activeAccount.account?.addressDetail?.address,
        targetAddress: recipientAddress,
      });
      const savedAccountMatchesRecipient = isSameSwapRecipientAddress({
        address: savedRecipientAccountInfo?.account?.addressDetail?.address,
        targetAddress: recipientAddress,
      });
      let recipientAccountInfo: IAccountSelectorActiveAccountInfo | undefined;
      if (targetNetworkAccountMatchesRecipient && accountForTargetNetwork) {
        recipientAccountInfo = {
          ...activeAccount,
          account: {
            ...accountForTargetNetwork,
          },
        };
      } else if (
        activeAccountMatchesRecipient &&
        activeAccount.network?.id === targetRecipientNetworkId
      ) {
        recipientAccountInfo = {
          ...activeAccount,
        };
      } else if (
        recipientNetworkId === targetRecipientNetworkId &&
        savedAccountMatchesRecipient &&
        savedRecipientAccountInfo
      ) {
        recipientAccountInfo = {
          ...savedRecipientAccountInfo,
        };
      }

      return {
        ...res,
        address: recipientAddress,
        networkId: targetRecipientNetworkId,
        isAddressInfoReady: true,
        accountInfo: recipientAccountInfo,
        activeAccount: {
          ...activeAccount,
        },
      };
    }

    const resolvedAccount = shouldResolveTargetNetworkAccount
      ? accountForTargetNetwork
      : activeAccount.account;

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
