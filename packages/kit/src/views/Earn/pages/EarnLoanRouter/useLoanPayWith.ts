import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IEarnPayWithToken } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useCommittedEarnScopeGuard } from '../../../Staking/hooks/useCommittedEarnScopeGuard';
import { preloadEarnPayWithTokenSelect } from '../../../Staking/router';
import {
  getEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  useEarnFunding,
} from '../EarnRouter/earnFundingRegistry';
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
  toPayTokenSwapToken,
  toPickedPayToken,
} from '../EarnRouter/earnRouter.utils';
import {
  refreshPickedPayToken,
  rememberPickedPayToken,
  usePayTokens,
} from '../EarnRouter/EarnRouterPayWith';
import {
  EarnSwapError,
  confirmEarnSwap,
  fetchEarnSwapQuote,
  prepareEarnSwap,
  readEarnSwapBalance,
  reconcileEarnSwapFunding,
  waitForEarnSwap,
  waitForEarnSwapBalance,
} from '../EarnRouter/earnRouterSwap';
import {
  createEarnSwapRecovery,
  persistEarnSwapHistory,
} from '../EarnRouter/earnRouterSwapHistory';

import {
  loanFundingGroup,
  loanOperationKey,
  pickLoanPayToken,
} from './loanRouter.utils';
import {
  getLoanPayPathForToken,
  getLoanWrappedFundingToken,
} from './loanWrappedFunding';
import { getLoanNetworkAccountId } from './useLoanRouterFacts';

import type { ILoanRoute } from './loanRouter.utils';
import type { ILoanRouterAccount } from './useLoanRouterFacts';
import type { IEarnDesktopMarketReserves } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnRouterPayToken } from '../EarnRouter/earnRouter.utils';
import type {
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
  unknown: undefined,
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
  markets,
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
  markets: IEarnDesktopMarketReserves[];
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const networkId = route?.market.networkId ?? '';
  const accountId = networkAccountId ?? '';
  const collateral = route?.collateral;
  const walletKey = JSON.stringify([
    loanAccount.accountId,
    loanAccount.indexedAccountId,
  ]);
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
  const [keptWrappedPick, setKeptWrappedPick] = useState<{
    key: string;
    token: IEarnRouterPayToken;
  }>();
  const [swapPhase, setSwapPhase] = useState<ILoanSwapPhase>('idle');
  const isFrozen = isLocked || swapPhase !== 'idle';
  const picked =
    findPayToken(pay.tokens, pickedKey) ??
    (keptWrappedPick &&
    keptWrappedPick.key === pickedKey &&
    keptWrappedPick.token.accountId === accountId &&
    keptWrappedPick.token.networkId === networkId
      ? keptWrappedPick.token
      : undefined);
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
  const wrappedFundingToken = useMemo(
    () => getLoanWrappedFundingToken({ route, payToken, accountId, markets }),
    [route, payToken, accountId, markets],
  );
  const keepWrappedPick = useCallback(() => {
    // The wallet omits zero-balance holdings after a full supply.
    if (wrappedFundingToken && picked && pickedKey) {
      setKeptWrappedPick({ key: pickedKey, token: picked });
    }
  }, [picked, pickedKey, wrappedFundingToken]);
  const path = route
    ? getLoanPayPathForToken({ route, payToken, wrappedFundingToken })
    : 'direct';
  const isSwapping = path !== 'direct';
  const isBridging = path === 'bridge';
  const canSpendPayToken =
    (!isBridging && !payToken?.isHoldingFallback) ||
    new BigNumber(payToken?.amount ?? '0').gt(0);
  // Where what pays is: the market's network unless it bridges
  const payNetworkId = isBridging
    ? payToken?.networkId || networkId
    : networkId;

  // The account on the market's network: where a bridge's tokens land, and
  // the one that pays a swap there
  const { result: marketAccount } = usePromiseResult(async () => {
    if (!accountId || !networkId) return undefined;
    const address = await backgroundApiProxy.serviceAccount
      .getAccountAddressForApi({ accountId, networkId })
      .catch(() => undefined);
    return address ? { accountId, networkId, address } : undefined;
  }, [accountId, networkId]);
  const account =
    marketAccount?.accountId === accountId &&
    marketAccount.networkId === networkId
      ? marketAccount
      : undefined;
  // Picker entries can outlive a wallet switch. Bind the payer to the
  // current wallet before using the pick for a quote or a transaction.
  const payTokenAccountId = payToken?.accountId;
  const [bridgePayerRetry, setBridgePayerRetry] = useState(0);
  const { result: bridgePayer } = usePromiseResult(async () => {
    if (
      !isBridging ||
      !payNetworkId ||
      !payTokenAccountId ||
      networkUtils.isAllNetwork({ networkId: payNetworkId })
    ) {
      return undefined;
    }
    const payer = await backgroundApiProxy.serviceAccount
      .getAccountAddressInfoForApi({
        accountId: payTokenAccountId,
        networkId: payNetworkId,
      })
      .catch(() => undefined);
    const matchesWallet = loanAccount.accountId
      ? payTokenAccountId === loanAccount.accountId
      : Boolean(
          loanAccount.indexedAccountId &&
          payer?.account.indexedAccountId === loanAccount.indexedAccountId,
        );
    if (
      !matchesWallet ||
      payer?.account.id !== payTokenAccountId ||
      !payer.address
    ) {
      return undefined;
    }
    return {
      walletKey,
      revision: bridgePayerRetry,
      account: {
        accountId: payTokenAccountId,
        networkId: payNetworkId,
        address: payer.address,
      },
    };
  }, [
    bridgePayerRetry,
    isBridging,
    loanAccount,
    payNetworkId,
    payTokenAccountId,
    walletKey,
  ]);
  let fromAccount = account;
  if (isBridging) {
    fromAccount =
      bridgePayer?.walletKey === walletKey &&
      bridgePayer.revision === bridgePayerRetry &&
      bridgePayer.account.networkId === payNetworkId &&
      bridgePayer.account.accountId === payTokenAccountId
        ? bridgePayer.account
        : undefined;
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
  const fundingKey = useMemo(() => {
    if (!route || !fromAccount || !account || !fromToken || !toToken) return '';
    return JSON.stringify([
      'loan',
      fromAccount.accountId,
      fromAccount.networkId,
      normalizeTaskAccountAddress(fromAccount.networkId, fromAccount.address),
      account.accountId,
      account.networkId,
      normalizeTaskAccountAddress(account.networkId, account.address),
      normalizeTaskAccountAddress(
        fromToken.networkId,
        fromToken.contractAddress,
      ),
      fromToken.isNative,
      normalizeTaskAccountAddress(toToken.networkId, toToken.contractAddress),
      toToken.isNative,
      route.market.provider.toLowerCase(),
      normalizeTaskAccountAddress(
        account.networkId,
        route.market.marketAddress,
      ),
      normalizeTaskAccountAddress(
        account.networkId,
        route.collateral.reserveAddress,
      ),
      normalizeTaskAccountAddress(
        account.networkId,
        route.borrow.reserveAddress,
      ),
    ]);
  }, [account, fromAccount, fromToken, route, toToken]);
  const retainedFunding = useEarnFunding(fundingKey);
  const scope = useCommittedEarnScopeGuard(fundingKey);
  const releaseFundedSwap = useCallback(async () => {
    if (fundingKey && getEarnFunding(fundingKey)?.status === 'funded') {
      await releaseEarnFunding(fundingKey);
    }
  }, [fundingKey]);
  const [isRecheckingFunding, setIsRecheckingFunding] = useState(false);
  const reconcileFunding = useCallback(async () => {
    if (!fundingKey || !fromToken || !toToken || !fromAccount || !account)
      return;
    const isCurrent = scope.capture();
    setIsRecheckingFunding(true);
    try {
      await reconcileEarnSwapFunding({
        scope: fundingKey,
        fromToken,
        toToken,
        account: fromAccount,
        toAccount,
      });
    } catch {
      if (isCurrent()) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }
    } finally {
      if (isCurrent()) setIsRecheckingFunding(false);
    }
  }, [
    account,
    fromAccount,
    fromToken,
    fundingKey,
    intl,
    scope,
    toAccount,
    toToken,
  ]);

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
  const canQuote =
    isSwapping &&
    canSpendPayToken &&
    Boolean(amountKey && toToken && fromAccount && account);
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
        onBest: (quote) => {
          if (!controller.signal.aborted)
            setQuoteState({ amount: amountKey, quote, isLoading: true });
        },
      })
        .then((quote) => {
          if (!controller.signal.aborted)
            setQuoteState({ amount: amountKey, quote, isLoading: false });
        })
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
  const pickerScope = useCommittedEarnScopeGuard(
    JSON.stringify([walletKey, accountId, networkId, route?.key]),
  );
  const pickerRevisionRef = useRef(0);
  const openPicker = useCallback(
    (
      onPicked: (isNewToken: boolean) => void,
      verifiedWrappedBalance?: string,
    ) => {
      if (!networkId) {
        return;
      }
      pickerRevisionRef.current += 1;
      const pickerRevision = pickerRevisionRef.current;
      const isPickerCurrent = pickerScope.capture();
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
                payWithAccountId:
                  fromAccount?.accountId === payToken.accountId
                    ? fromAccount?.accountId
                    : undefined,
              }
            : undefined,
          verifiedBalance:
            wrappedFundingToken && verifiedWrappedBalance !== undefined
              ? {
                  address: wrappedFundingToken.address,
                  amount: verifiedWrappedBalance,
                }
              : undefined,
          // Swap's network column too: a token on another network is bridged
          // to the market's first (11-05). All Networks lists the wallet's
          // tokens and the column sums them, as the deposit modal's picker
          acrossNetworks: true,
          preservePayWithAccount: true,
          heldTokens: heldTokens.map((item) => ({
            ...toPayTokenSwapToken(item),
            payWithAccountId: item.accountId,
          })),
          accountIdByNetwork: Object.fromEntries(
            heldTokens.flatMap((item) =>
              item.accountId ? [[item.networkId, item.accountId]] : [],
            ),
          ),
          onSelect: (token: IEarnPayWithToken) => {
            if (
              pickerRevision !== pickerRevisionRef.current ||
              !isPickerCurrent()
            ) {
              return;
            }
            pickerScope.invalidate();
            const isSelectionCurrent = pickerScope.capture();
            const tokenAccountId =
              token.payWithAccountId ??
              (token.networkId === networkId
                ? accountId
                : heldTokens.find((held) => held.networkId === token.networkId)
                    ?.accountId);
            const pickOptions = {
              depositToken: collateral
                ? { address: collateral.address, isNative: !collateral.address }
                : undefined,
              depositSymbol: collateral?.symbol ?? '',
              depositNetworkId: networkId,
              accountId: tokenAccountId,
            };
            const item = toPickedPayToken({
              ...pickOptions,
              token,
              tokens: heldTokens,
            });
            const isCachedPick = !heldTokens.includes(item);
            // Keep the exact source when a refreshed list drops its zero balance.
            const selection =
              !isCachedPick && token.payWithAccountId
                ? {
                    ...toPickedPayToken({
                      ...pickOptions,
                      token: { ...token, balanceParsed: '0', fiatValue: '0' },
                      tokens: [],
                    }),
                    isHoldingFallback: true,
                  }
                : item;
            if (isCachedPick || selection !== item) {
              rememberPickedPayToken(token.networkId, selection);
            }
            setPickedKey(selection.key);
            onPicked(item.key !== payToken?.key);
            if (item.accountId) {
              if (isCachedPick) {
                void refreshPickedPayToken({
                  accountId: item.accountId,
                  networkId: token.networkId,
                  item,
                });
              }
              if (
                isBridging &&
                !fromAccount &&
                item.networkId === payNetworkId &&
                item.accountId === payTokenAccountId
              ) {
                setBridgePayerRetry((revision) => revision + 1);
              }
            } else if (isCachedPick) {
              void getLoanNetworkAccountId({
                account: loanAccount,
                networkId: token.networkId,
              }).then((sourceAccountId) => {
                if (!sourceAccountId || !isSelectionCurrent()) return;
                const boundItem = { ...item, accountId: sourceAccountId };
                if (rememberPickedPayToken(token.networkId, boundItem, item)) {
                  void refreshPickedPayToken({
                    accountId: sourceAccountId,
                    networkId: token.networkId,
                    item: boundItem,
                  });
                }
              });
            }
          },
        },
      });
    },
    [
      accountId,
      collateral,
      fromAccount,
      heldTokens,
      isBridging,
      loanAccount,
      navigation,
      networkId,
      payNetworkId,
      payToken,
      payTokenAccountId,
      payTokenAddressesKey,
      pickerScope,
      wrappedFundingToken,
    ],
  );

  // ---------- The swap or the bridge ----------

  // Signed where it pays: the pay token's network
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: fromAccount?.accountId ?? accountId,
    networkId: fromAccount?.networkId ?? networkId,
  });
  // In the Swap history, as any swap: the in-app notice follows it to the end
  const recordSwap = useCallback(
    async (
      txId: string,
      prepared: IEarnSwapPrepared,
      sent?: ISendTxOnSuccessData,
    ) => {
      await persistEarnSwapHistory({
        txId,
        swapInfo: prepared.execution.swapInfo,
        sent,
        currencyInfo,
      });
    },
    [currencyInfo],
  );

  const runRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    runRef.current?.abort();
    setSwapPhase('idle');
    return () => runRef.current?.abort();
  }, [fundingKey]);
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
    }): Promise<
      | {
          amount: string;
          balance?: string;
          receipt: { scope: string; txId: string };
        }
      | undefined
    > => {
      if (
        !route ||
        !fromAccount ||
        !account ||
        !fromToken ||
        !toToken ||
        !collateral
      ) {
        return undefined;
      }
      if (!fundingKey) return undefined;
      const isCurrent = scope.capture();
      let retained: Awaited<ReturnType<typeof refreshEarnFunding>>;
      try {
        const priorSupply = await refreshEarnFunding(
          loanOperationKey(
            {
              route,
              networkAccountId: account.accountId,
              accountAddress: account.address,
            },
            'supply',
          ),
        );
        if (!isCurrent() || priorSupply) return undefined;
        retained = await refreshEarnFunding(fundingKey);
      } catch {
        if (isCurrent())
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.global_failed }),
          });
        return undefined;
      }
      if (!isCurrent()) return undefined;
      if (retained?.status === 'funded') {
        try {
          const balance = await readEarnSwapBalance({
            token: toToken,
            account,
          });
          const current = getEarnFunding(fundingKey);
          if (
            !isCurrent() ||
            current?.status !== 'funded' ||
            current.txId !== retained.txId ||
            current.receivedAmount !== retained.receivedAmount
          )
            return undefined;
          const resumedAmount = getEarnSwapDepositAmount({
            receivedAmount: retained.receivedAmount,
            balanceAfter: balance,
            decimals: Math.min(collateral.decimals, 8),
          });
          if (new BigNumber(resumedAmount).gt(0)) {
            return {
              amount: resumedAmount,
              balance,
              receipt: { scope: fundingKey, txId: retained.txId },
            };
          }
        } catch {
          if (!isCurrent()) return undefined;
        }
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.earn_pending_transactions_data_out_of_sync,
          }),
        });
        return undefined;
      }
      if (retained || !canSpendPayToken) return undefined;
      const group = loanFundingGroup({
        accountId: account.accountId,
        networkId: account.networkId,
        address: account.address,
        provider: route.market.provider,
        marketAddress: route.market.marketAddress,
      });
      const reservation = reserveEarnFunding(fundingKey, {
        amount: payAmount,
        group,
        startsGroup: true,
      });
      if (!reservation) return undefined;
      const controller = new AbortController();
      runRef.current = controller;
      const { signal } = controller;
      setSwapPhase('preparing');
      let confirmationOwnsReservation = false;
      let txId: string | undefined;
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
        if (!isCurrent() || signal.aborted)
          throw new EarnSwapError('cancelled');
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
        if (signal.aborted || !isCurrent()) {
          throw new EarnSwapError('cancelled');
        }
        setSwapPhase('confirming');
        const swapRecovery = createEarnSwapRecovery({ prepared, currencyInfo });
        confirmationOwnsReservation = true;
        const sent = await confirmEarnSwap({
          prepared,
          reservation,
          fundingKey,
          isCurrent,
          signal,
          navigateToConfirm: navigationToTxConfirm,
          swapRecovery,
          onAccepted: async (acceptedId, accepted) => {
            try {
              await recordSwap(acceptedId, prepared, accepted);
            } catch {
              throw new EarnSwapError('unknown');
            }
          },
        });
        if (!sent) {
          if (isCurrent()) setSwapPhase('idle');
          return undefined;
        }
        if (!isCurrent()) return undefined;
        txId = sent.signedTx.txid;
        setSwapPhase('landing');
        const { receivedAmount } = await waitForEarnSwap({
          txId,
          prepared,
          toToken,
          account: fromAccount,
          toAccount,
          signal,
        });
        if (!receivedAmount) throw new EarnSwapError('unknown');
        const balanceAfter = await waitForEarnSwapBalance({
          token: toToken,
          atLeast: receivedAmount,
          account,
          signal,
        });
        const received = getEarnSwapDepositAmount({
          receivedAmount,
          balanceAfter,
          decimals: Math.min(collateral.decimals, 8),
        });
        if (!new BigNumber(received).gt(0)) throw new EarnSwapError('unknown');
        await reservation.markFunded(received);
        const funded = getEarnFunding(fundingKey);
        if (funded?.status !== 'funded' || funded.txId !== txId) {
          throw new EarnSwapError('unknown');
        }
        if (!isCurrent()) return undefined;
        setSwapPhase('idle');
        // A bridge moved its own network's balances too
        void pay.refresh(
          toAccount && fromAccount ? [fromAccount.networkId] : undefined,
          fromAccount,
        );
        return {
          amount: received,
          balance: balanceAfter,
          receipt: { scope: fundingKey, txId },
        };
      } catch (error: unknown) {
        let reason = error instanceof EarnSwapError ? error.reason : 'failed';
        try {
          if (!confirmationOwnsReservation) await reservation.release();
          if (txId && reason === 'failed') {
            await releaseEarnFunding(fundingKey, txId);
          }
        } catch {
          reason = 'unknown';
        }
        if (signal.aborted || !isCurrent()) return undefined;
        setSwapPhase('idle');
        // Errors the swap service raised have shown their own toast
        if ((error as IOneKeyError | undefined)?.autoToast) {
          return undefined;
        }
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
      } finally {
        if (runRef.current === controller) runRef.current = undefined;
      }
    },
    [
      account,
      canSpendPayToken,
      collateral,
      currencyInfo,
      fromAccount,
      fromToken,
      fundingKey,
      intl,
      navigationToTxConfirm,
      pay,
      recordSwap,
      route,
      scope,
      toAccount,
      toToken,
    ],
  );

  return {
    payToken,
    wrappedFundingToken,
    keepWrappedPick,
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
    hasFundedSwap: retainedFunding?.status === 'funded',
    fundedReceipt:
      retainedFunding?.status === 'funded'
        ? { scope: fundingKey, txId: retainedFunding.txId }
        : undefined,
    canReconcileFunding:
      retainedFunding?.status === 'submitted' ||
      Boolean(
        retainedFunding?.status === 'unknown' &&
        !retainedFunding.txIdConflict &&
        retainedFunding.swapTxUuid &&
        retainedFunding.swapRecovery,
      ),
    reconcileFunding,
    isRecheckingFunding,
    quoteFor,
    swap,
    swapPhase:
      retainedFunding && retainedFunding.status !== 'funded'
        ? 'landing'
        : swapPhase,
    isSwapRunning:
      swapPhase !== 'idle' ||
      Boolean(retainedFunding && retainedFunding.status !== 'funded'),
    fundingKey,
    releaseFundedSwap,
    canSwap: Boolean(
      canSpendPayToken &&
      fromAccount &&
      fromToken &&
      toToken &&
      (!isBridging || toAccount),
    ),
    isLoaded: pay.isLoaded,
    refresh: pay.refresh,
  };
}

export type ILoanPayWith = ReturnType<typeof useLoanPayWith>;
