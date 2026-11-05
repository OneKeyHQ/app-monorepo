import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { preloadEarnPayWithTokenSelect } from '../../../Staking/router';
import { completeBroadcastedSwapSuccess } from '../../../Swap/hooks/swapBroadcastSuccess';
import { generateSwapHistoryItemForContext } from '../../../Swap/hooks/useSwapTxHistory';
import {
  readPayWithPickerAccountAddress,
  readPayWithPickerNetwork,
  warmPayWithPickerTokens,
} from '../EarnRouter/earnPayWithPickerData';
import {
  buildEarnSwapToken,
  findPayToken,
  getEarnSwapDepositAmount,
  getEarnSwapPayMax,
  getPayTokenAddress,
  toPickedPayToken,
} from '../EarnRouter/earnRouter.utils';
import {
  refreshPickedPayToken,
  rememberPickedPayToken,
  usePayTokens,
} from '../EarnRouter/EarnRouterPayWith';
import {
  EarnSwapError,
  fetchEarnSwapQuote,
  prepareEarnSwap,
  readEarnSwapBalance,
  waitForEarnSwap,
  waitForEarnSwapBalance,
} from '../EarnRouter/earnRouterSwap';

import { getLoanPayPath, pickLoanPayToken } from './loanRouter.utils';
import { getLoanNetworkAccountId } from './useLoanRouterFacts';

import type { ILoanRoute } from './loanRouter.utils';
import type { ILoanRouterAccount } from './useLoanRouterFacts';
import type { IEarnRouterPayToken } from '../EarnRouter/earnRouter.utils';
import type {
  IEarnSwapAccount,
  IEarnSwapPrepared,
  IEarnSwapReason,
} from '../EarnRouter/earnRouterSwap';

// The Loans window's Pay with, as the deposit modal's: what leaves the
// wallet for the collateral. Since 11-05 it pays from any network: the
// wallet's largest holding of the collateral wherever it is, else what it
// holds most of, or a token picked in Swap's picker. Paid with another token
// on the market's network, a swap comes first; from another network, a
// bridge to the market's (a swap on the way where it is another token). What
// either brings is supplied

// Typing settles before the swap service is asked, as in the deposit modal
const QUOTE_DEBOUNCE_MS = 500;

const SWAP_ERROR_MESSAGE: Record<IEarnSwapReason, ETranslations | undefined> = {
  noRoute: ETranslations.swap_page_alert_no_provider_supports_trade,
  unsupported: ETranslations.swap_page_alert_no_provider_supports_trade,
  failed: ETranslations.swap_page_toast_swap_failed,
  cancelled: undefined,
};

export type ILoanSwapQuote = {
  amount: string;
  quote?: IFetchQuoteResult;
  isLoading: boolean;
  reason?: IEarnSwapReason;
};

const NO_QUOTE: ILoanSwapQuote = { amount: '', isLoading: false };

export type ILoanSwapPhase = 'idle' | 'preparing' | 'confirming' | 'landing';

// The pay token's own token, as the swap service takes it
const toSwapToken = (networkId: string, item: IEarnRouterPayToken) =>
  buildEarnSwapToken({
    networkId,
    token: item.token,
    priceUsd: item.priceUsd,
  });

export function useLoanPayWith({
  route,
  networkAccountId,
  loanAccount,
  typedAmount,
  isLocked,
  startKey,
}: {
  route?: ILoanRoute;
  // The account on the market's network: where the collateral lands and is
  // supplied from
  networkAccountId?: string;
  // The wallet's account, for its account on a network it holds nothing on
  loanAccount: ILoanRouterAccount;
  // What the box holds: an amount of the pay token
  typedAmount: string;
  isLocked: boolean;
  // The token to start on (the window opened again as it was left)
  startKey?: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const networkId = route?.market.networkId ?? '';
  const accountId = networkAccountId ?? '';
  const collateral = route?.collateral;
  const pay = usePayTokens({
    accountId,
    networkId,
    depositSymbol: collateral?.symbol ?? '',
    enabled: Boolean(route),
    acrossNetworks: true,
  });
  // A token picked in the picker, kept on every market: one on another
  // network than the market's is bridged there
  const [pickedKey, setPickedKey] = useState<string | undefined>(startKey);
  const [swapPhase, setSwapPhase] = useState<ILoanSwapPhase>('idle');
  const isFrozen = isLocked || swapPhase !== 'idle';
  const picked = findPayToken(pay.tokens, pickedKey);
  // What pays for a market's collateral: the token picked, else the
  // wallet's largest holding of the collateral on any network, else its
  // largest holding. The window asks for each market's card too
  const { heldTokens } = pay;
  const payTokenFor = useCallback(
    (collateralSymbol: string) =>
      picked ?? pickLoanPayToken(heldTokens, collateralSymbol),
    [heldTokens, picked],
  );
  const payToken = collateral ? payTokenFor(collateral.symbol) : undefined;
  // Paid with something else than the collateral there, a swap or a bridge
  // brings it first. A wrapped twin (ETH for WETH) is the collateral itself,
  // as the market takes it
  const path = collateral
    ? getLoanPayPath({
        payToken: payToken && {
          networkId: payToken.networkId,
          symbol: payToken.token.symbol,
        },
        collateral,
      })
    : 'direct';
  const isSwapping = path !== 'direct';
  const isBridging = path === 'bridge';
  // Where what pays is: the market's network unless it bridges
  const payNetworkId = isBridging
    ? payToken?.networkId || networkId
    : networkId;

  // The account on the market's network: where a bridge's tokens land, and
  // the one that pays a swap there
  const { result: address } = usePromiseResult(
    async () =>
      accountId && networkId
        ? backgroundApiProxy.serviceAccount
            .getAccountAddressForApi({ accountId, networkId })
            .catch(() => undefined)
        : undefined,
    [accountId, networkId],
  );
  const account = useMemo<IEarnSwapAccount | undefined>(
    () =>
      accountId && address && networkId
        ? { accountId, networkId, address }
        : undefined,
    [accountId, address, networkId],
  );
  // The account that pays a bridge, on the pay token's network: the
  // wallet's there where it holds the token, else found as the Earn pages
  // find an account on a network
  const payTokenAccountId = payToken?.accountId;
  const { result: bridgeAccount } = usePromiseResult(async (): Promise<
    IEarnSwapAccount | undefined
  > => {
    if (!isBridging || !payNetworkId) {
      return undefined;
    }
    const id =
      payTokenAccountId ||
      (await getLoanNetworkAccountId({
        account: loanAccount,
        networkId: payNetworkId,
      }));
    if (!id) {
      return undefined;
    }
    const bridgeAddress = await backgroundApiProxy.serviceAccount
      .getAccountAddressForApi({ accountId: id, networkId: payNetworkId })
      .catch(() => undefined);
    return bridgeAddress
      ? { accountId: id, networkId: payNetworkId, address: bridgeAddress }
      : undefined;
  }, [isBridging, loanAccount, payNetworkId, payTokenAccountId]);
  // The one that pays, and where a bridge lands (none for a swap: the payer).
  // The last network's account, while another's is read, pays nothing
  const isBridgeAccountRead = bridgeAccount?.networkId === payNetworkId;
  let fromAccount = account;
  if (isBridging) {
    fromAccount = isBridgeAccountRead ? bridgeAccount : undefined;
  }
  const toAccount = isBridging ? account : undefined;
  // What the pay token's network's coin keeps back for fees, as the Swap
  // page's Max does
  const isNativePay = Boolean(payToken?.token.isNative);
  const { result: nativeConfig } = usePromiseResult(
    async () =>
      isNativePay && payNetworkId
        ? backgroundApiProxy.serviceSwap
            .fetchSwapNativeTokenConfig({ networkId: payNetworkId })
            .catch(() => undefined)
        : undefined,
    [isNativePay, payNetworkId],
  );
  const payMax = payToken
    ? getEarnSwapPayMax({
        balance: payToken.amount,
        isNative: payToken.token.isNative,
        reserveGas: nativeConfig?.reserveGas,
        decimals: Math.min(payToken.token.decimals, 8),
      })
    : undefined;

  // The swap's two tokens, each on its own network
  const fromToken = useMemo(
    () =>
      payToken && payNetworkId
        ? toSwapToken(payNetworkId, payToken)
        : undefined,
    [payNetworkId, payToken],
  );
  const toToken = useMemo(
    () =>
      collateral && networkId
        ? buildEarnSwapToken({
            networkId,
            token: {
              address: collateral.address,
              decimals: collateral.decimals,
              symbol: collateral.symbol,
              name: collateral.name,
              logoURI: collateral.logoURI,
              isNative: !collateral.address,
            },
          })
        : undefined,
    [collateral, networkId],
  );

  // What the swap service quotes for the amount, asked again as it changes.
  // Asked for the tokens and the amount, not for the token objects: a
  // refresh that builds them again asks nothing new
  const [quoteState, setQuoteState] = useState<ILoanSwapQuote>(NO_QUOTE);
  const amount = new BigNumber(typedAmount);
  const hasAmount = amount.isFinite() && amount.gt(0);
  const amountKey = hasAmount ? amount.toFixed() : '';
  const tokensRef = useRef({ fromToken, toToken });
  tokensRef.current = { fromToken, toToken };
  const tokensKey = [fromToken, toToken]
    .map((token) =>
      token
        ? [
            token.networkId,
            token.contractAddress,
            token.isNative ? 'native' : '',
            token.decimals,
          ].join(':')
        : '',
    )
    .join('>');
  const canQuote = isSwapping && Boolean(amountKey) && Boolean(toToken);
  useEffect(() => {
    // While the press runs the estimate stays as it went to the wallet
    if (isFrozen) {
      return undefined;
    }
    if (!canQuote) {
      setQuoteState(NO_QUOTE);
      return undefined;
    }
    const controller = new AbortController();
    setQuoteState((prev) => ({
      amount: amountKey,
      // Another amount's quote stays (dimmed) while this one's is asked for
      quote: prev.quote,
      isLoading: true,
    }));
    const timer = setTimeout(() => {
      const tokens = tokensRef.current;
      if (!tokens.fromToken || !tokens.toToken) {
        return;
      }
      fetchEarnSwapQuote({
        fromToken: tokens.fromToken,
        toToken: tokens.toToken,
        amount: amountKey,
        account: fromAccount,
        toAccount,
        signal: controller.signal,
        onBest: (quote) =>
          setQuoteState({ amount: amountKey, quote, isLoading: true }),
      })
        .then((quote) =>
          setQuoteState({ amount: amountKey, quote, isLoading: false }),
        )
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setQuoteState({
              amount: amountKey,
              isLoading: false,
              reason: error instanceof EarnSwapError ? error.reason : 'noRoute',
            });
          }
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [amountKey, canQuote, fromAccount, isFrozen, toAccount, tokensKey]);
  // The collateral the amount brings, once quoted for exactly this amount
  const quoteFor = (value: string) =>
    quoteState.amount === value && quoteState.quote?.toAmount
      ? quoteState.quote.toAmount
      : undefined;
  const estimatedSupply = canQuote ? quoteFor(amountKey) : undefined;
  // The last amount's quote, shown dimmed while this one's is asked for: its
  // estimate, and a bridge's time and fee
  const shownQuote = canQuote ? quoteState.quote : undefined;
  const shownSupply = shownQuote?.toAmount || undefined;
  const isQuoting =
    canQuote && (quoteState.isLoading || quoteState.amount !== amountKey);
  const hasNoRoute =
    canQuote &&
    !quoteState.isLoading &&
    quoteState.amount === amountKey &&
    Boolean(quoteState.reason) &&
    quoteState.reason !== 'cancelled';

  // ---------- The picker ----------

  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ swapShowLpTokensOnly }] = useTokenSelectorFilterPersistAtom();
  const { gtMd } = useMedia();
  const isWide = Boolean((platformEnv.isDesktop || platformEnv.isWeb) && gtMd);
  // The picker opens on the market's network: the wallet's tokens there
  const payTokenAddressesKey = useMemo(
    () =>
      heldTokens
        .filter((item) => item.networkId === networkId)
        .map(getPayTokenAddress)
        .filter(Boolean)
        .join(','),
    [heldTokens, networkId],
  );
  // Read ahead, so the picker's first open is complete
  useEffect(() => {
    if (!networkId) {
      return;
    }
    void preloadEarnPayWithTokenSelect();
    void readPayWithPickerNetwork(networkId);
    if (accountId) {
      void readPayWithPickerAccountAddress({ accountId, networkId });
    }
    void warmPayWithPickerTokens({
      accountId,
      networkId,
      currencyId: currencyInfo.id,
      showLpTokensOnly: swapShowLpTokensOnly,
      isWide,
      payTokenAddresses: payTokenAddressesKey
        ? payTokenAddressesKey.split(',')
        : [],
    });
    // Read once per network and account: the picker reads its own after
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, networkId]);

  // Picking another token starts the amount over, as an amount of the last
  // token means nothing in this one: `onPicked` hears whether it changed
  const openPicker = useCallback(
    (onPicked: (isNewToken: boolean) => void) => {
      if (!networkId) {
        return;
      }
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.EarnPayWithTokenSelect,
        params: {
          accountId,
          networkId,
          payTokenAddresses: payTokenAddressesKey
            ? payTokenAddressesKey.split(',')
            : [],
          selectedToken: payToken
            ? {
                address: payToken.token.address,
                isNative: Boolean(payToken.token.isNative),
                networkId: payToken.networkId,
              }
            : undefined,
          // Swap's network column too: a token on another network is bridged
          // to the market's first (11-05)
          acrossNetworks: true,
          onSelect: (token: ISwapToken) => {
            // The wallet's account on the token's network, where known
            const tokenAccountId =
              token.networkId === networkId
                ? accountId
                : heldTokens.find((held) => held.networkId === token.networkId)
                    ?.accountId;
            const item = toPickedPayToken({
              token,
              tokens: heldTokens,
              depositToken: collateral
                ? { address: collateral.address, isNative: !collateral.address }
                : undefined,
              depositSymbol: collateral?.symbol ?? '',
              depositNetworkId: networkId,
              accountId: tokenAccountId,
            });
            if (!heldTokens.some((held) => held.key === item.key)) {
              rememberPickedPayToken(token.networkId, item);
              void refreshPickedPayToken({
                accountId: tokenAccountId || accountId,
                networkId: token.networkId,
                item,
              });
            }
            setPickedKey(item.key);
            onPicked(item.key !== payToken?.key);
          },
        },
      });
    },
    [
      accountId,
      collateral,
      heldTokens,
      navigation,
      networkId,
      payToken,
      payTokenAddressesKey,
    ],
  );

  // ---------- The swap or the bridge ----------

  // Signed where it pays: the pay token's network
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: fromAccount?.accountId ?? accountId,
    networkId: fromAccount?.networkId ?? networkId,
  });
  // The wallet's confirm for the swap, as the Swap page sends one (with an
  // approval in the same confirm): what went out, nothing when rejected
  const confirmSwap = useCallback(
    (prepared: IEarnSwapPrepared) =>
      new Promise<ISendTxOnSuccessData | undefined>((resolve, reject) => {
        let isSettled = false;
        const settle = (data?: ISendTxOnSuccessData) => {
          if (!isSettled) {
            isSettled = true;
            resolve(data);
          }
        };
        const fail = (error: unknown) => {
          if (!isSettled) {
            isSettled = true;
            reject(error);
          }
        };
        void navigationToTxConfirm({
          isInternalSwap: true,
          encodedTx: prepared.execution.encodedTx,
          approvesInfo: prepared.approvesInfo.length
            ? prepared.approvesInfo
            : undefined,
          swapInfo: prepared.execution.swapInfo,
          onSuccess: (data) =>
            settle(
              data.find(
                (item) => item.signedTx.swapInfo && !item.approveInfo,
              ) ?? data[data.length - 1],
            ),
          onFail: fail,
          onCancel: () => settle(),
        }).catch(fail);
      }),
    [navigationToTxConfirm],
  );
  // In the Swap history, as any swap: the in-app notice follows it to the end
  const recordSwap = useCallback(
    async (sent: ISendTxOnSuccessData, prepared: IEarnSwapPrepared) => {
      const swapNetworks = await backgroundApiProxy.serviceSwap
        .fetchSwapNetworks()
        .catch(() => []);
      await completeBroadcastedSwapSuccess({
        txId: sent.signedTx.txid,
        swapInfo: prepared.execution.swapInfo,
        gasFeeFiatValue: sent.decodedTx.totalFeeFiatValue,
        gasFeeInNative: sent.decodedTx.totalFeeInNative,
        generateSwapHistoryItem: (params) =>
          generateSwapHistoryItemForContext(params, {
            swapNetworks,
            currencyInfo,
          }),
      });
    },
    [currencyInfo],
  );

  const runRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => runRef.current?.abort(), []);
  /**
   * One press's swap or bridge: a fresh quote, the wallet's confirm on the
   * pay token's network, the wait for what it brings to land on the market's
   * (a bridge, until it is out on the other side). What it brought (rounded
   * down to what the market takes), or nothing when it was rejected or failed
   * (a toast says why)
   */
  const swap = useCallback(
    async ({
      payAmount,
    }: {
      payAmount: string;
    }): Promise<{ amount: string; balance?: string } | undefined> => {
      if (!fromAccount || !account || !fromToken || !toToken || !collateral) {
        return undefined;
      }
      const controller = new AbortController();
      runRef.current?.abort();
      runRef.current = controller;
      const { signal } = controller;
      setSwapPhase('preparing');
      try {
        // The one on screen may be a while old
        const freshQuote = await fetchEarnSwapQuote({
          fromToken,
          toToken,
          amount: payAmount,
          account: fromAccount,
          toAccount,
          signal,
        });
        setQuoteState({
          amount: payAmount,
          quote: freshQuote,
          isLoading: false,
        });
        const prepared = await prepareEarnSwap({
          quote: freshQuote,
          fromToken,
          toToken,
          amount: payAmount,
          account: fromAccount,
          toAccount,
        });
        // The collateral is read where it lands: the market's network
        const balanceBefore = await readEarnSwapBalance({
          token: toToken,
          account,
        });
        if (signal.aborted) {
          throw new EarnSwapError('cancelled');
        }
        setSwapPhase('confirming');
        const sent = await confirmSwap(prepared);
        if (!sent) {
          setSwapPhase('idle');
          return undefined;
        }
        setSwapPhase('landing');
        void recordSwap(sent, prepared);
        const leastReceived =
          freshQuote.minToAmount || freshQuote.toAmount || '0';
        const { receivedAmount } = await waitForEarnSwap({
          txId: sent.signedTx.txid,
          prepared,
          toToken,
          account: fromAccount,
          toAccount,
          landedBalance:
            balanceBefore === undefined
              ? undefined
              : new BigNumber(balanceBefore).plus(leastReceived).toFixed(),
          signal,
        });
        const expected = receivedAmount || leastReceived;
        const balanceAfter = await waitForEarnSwapBalance({
          token: toToken,
          atLeast: new BigNumber(balanceBefore ?? 0).plus(expected).toFixed(),
          account,
          signal,
        });
        const received = getEarnSwapDepositAmount({
          receivedAmount,
          balanceBefore,
          balanceAfter,
          minToAmount: freshQuote.minToAmount,
          decimals: Math.min(collateral.decimals, 8),
        });
        setSwapPhase('idle');
        // A bridge moved its own network's balances too
        void pay.refresh(
          toAccount && fromAccount ? [fromAccount.networkId] : undefined,
        );
        return received
          ? { amount: received, balance: balanceAfter }
          : undefined;
      } catch (error: unknown) {
        setSwapPhase('idle');
        if (signal.aborted) {
          return undefined;
        }
        // Errors the swap service raised have shown their own toast
        if ((error as IOneKeyError | undefined)?.autoToast) {
          return undefined;
        }
        const reason = error instanceof EarnSwapError ? error.reason : 'failed';
        // A bridge that failed says so in the Swap history's words
        const messageId =
          reason === 'failed' && toAccount
            ? ETranslations.swap_history_detail_badge_bridge_failed
            : SWAP_ERROR_MESSAGE[reason];
        if (messageId) {
          Toast.error({
            title: intl.formatMessage({ id: messageId }),
            message:
              error instanceof EarnSwapError && error.message !== reason
                ? error.message
                : undefined,
          });
        }
        return undefined;
      }
    },
    [
      account,
      collateral,
      confirmSwap,
      fromAccount,
      fromToken,
      intl,
      pay,
      recordSwap,
      toAccount,
      toToken,
    ],
  );

  return {
    payToken,
    // What pays for a market's collateral, for the markets' cards
    payTokenFor,
    // What comes before the supply: nothing, a swap, or a bridge
    path,
    // A swap or a bridge brings the collateral first
    isSwapping,
    isBridging,
    payMax,
    // Picked in the picker, against the default
    isPicked: Boolean(picked),
    pickedKey,
    setPickedKey,
    openPicker,
    estimatedSupply,
    shownSupply,
    shownQuote,
    isQuoting,
    hasNoRoute,
    quoteFor,
    swap,
    swapPhase,
    isSwapRunning: swapPhase !== 'idle',
    canSwap: Boolean(
      fromAccount && fromToken && toToken && (!isBridging || toAccount),
    ),
    isLoaded: pay.isLoaded,
    refresh: pay.refresh,
  };
}

export type ILoanPayWith = ReturnType<typeof useLoanPayWith>;
