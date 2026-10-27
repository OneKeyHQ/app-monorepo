import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  resolveBorrowTokenApproveSpenderAddress,
  shouldUseAaveNativeGateway,
} from '../../../Borrow/components/borrowRepayPosition.utils';
import {
  attachBorrowOrderId,
  handleBorrowSuccess,
  parseBorrowEncodedTx,
} from '../../../Borrow/hooks/useUniversalBorrowWithdrawRepayHooks';
import { useEarnRiskWarningGate } from '../../../Staking/components/EarnRiskWarningDialog';
import { buildBorrowTag } from '../../../Staking/utils/utils';

import { readLoanRoutePosition } from './useLoanRouterFacts';

import type { ILoanRoute, ILoanRouterToken } from './loanRouter.utils';

// One press: the collateral's approval when it needs one, the supply, a wait
// for the supply to land, then the loan (after the delegation an ETH loan
// needs on Aave). Each step is a confirm of the wallet's own. Rejecting the
// supply leaves everything as it was; rejecting the loan leaves the
// collateral supplied, and the form offers the loan alone

export type ILoanRunPhase =
  | 'idle'
  // Pressed: the allowance is read before any step shows
  | 'preparing'
  | 'approving'
  | 'supplying'
  | 'landing'
  | 'borrowing'
  // The collateral is in; the loan wasn't sent (rejected, or the supply took
  // longer than the wait)
  | 'borrowReady'
  | 'done';

export type ILoanRunPlan = {
  route: ILoanRoute;
  networkAccountId: string;
  collateralAmount: string;
  borrowAmount: string;
  // The market's logo, for the confirm screens
  marketLogoURI?: string;
};

export type ILoanRunDone = {
  plan: ILoanRunPlan;
  // Collateral went in on this press (none when only borrowing)
  supplied: boolean;
};

// After the supply is final, the market's own figures can lag a moment
const POSITION_SETTLE_ATTEMPTS = 6;
const POSITION_SETTLE_INTERVAL_MS = 2500;

const toIToken = (token: ILoanRouterToken): IToken =>
  ({
    address: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name || token.symbol,
    logoURI: token.logoURI,
    networkId: token.networkId,
    isNative: !token.address,
  }) as IToken;

// The last transaction sent: an approval's own, or the action after it
const getSentTxid = (data: { signedTx?: { txid?: string } }[] | undefined) => {
  for (let index = (data?.length ?? 0) - 1; index >= 0; index -= 1) {
    const txid = data?.[index]?.signedTx?.txid;
    if (txid) {
      return txid;
    }
  }
  return '';
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

class LoanRunStopped extends Error {}

export function useLoanRouterRun({
  route,
  networkAccountId,
  onDone,
}: {
  route?: ILoanRoute;
  networkAccountId?: string;
  onDone: (done: ILoanRunDone) => void;
}) {
  const intl = useIntl();
  const [phase, setPhase] = useState<ILoanRunPhase>('idle');
  // Shown as a step of its own once the press finds the collateral needs it
  const [hasApprovalStep, setHasApprovalStep] = useState(false);
  // The press the loan is waiting on, kept to send the loan alone
  const pendingPlanRef = useRef<ILoanRunPlan | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abortRef.current?.abort(), []);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const networkId = route?.market.networkId ?? '';
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: networkAccountId ?? '',
    networkId,
  });
  const ensureRiskAccepted = useEarnRiskWarningGate();

  // The wallet's confirm: whether it went out; a rejection or a failed send
  // reads as not sent. A lending transaction is tracked as the Borrow
  // page's are
  const confirm = useCallback(
    ({
      plan,
      encodedTx,
      approvesInfo,
      stakingInfo,
      orderId,
    }: {
      plan: ILoanRunPlan;
      encodedTx?: IEncodedTx;
      approvesInfo?: IApproveInfo[];
      stakingInfo?: IStakingInfo;
      orderId?: string;
    }) =>
      new Promise<string | undefined>((resolve) => {
        let isSettled = false;
        const settle = (txid?: string) => {
          if (!isSettled) {
            isSettled = true;
            resolve(txid);
          }
        };
        void navigationToTxConfirm({
          encodedTx,
          approvesInfo,
          stakingInfo,
          onSuccess: (data) => {
            settle(getSentTxid(data) || 'sent');
            if (encodedTx && stakingInfo) {
              void handleBorrowSuccess({
                data,
                orderId,
                networkId: plan.route.market.networkId,
                accountId: plan.networkAccountId,
                stakingInfo,
              }).catch(() => undefined);
            }
          },
          onFail: () => settle(undefined),
          onCancel: () => settle(undefined),
        }).catch(() => settle(undefined));
      }),
    [navigationToTxConfirm],
  );

  const waitForFinal = useCallback(
    async (plan: ILoanRunPlan, txid: string, signal: AbortSignal) => {
      if (!txid || txid === 'sent') {
        return true;
      }
      const status = await waitForTxFinalStatus({
        accountId: plan.networkAccountId,
        networkId: plan.route.market.networkId,
        txid,
        signal,
      });
      if (signal.aborted) {
        throw new LoanRunStopped();
      }
      return status === EOnChainHistoryTxStatus.Success;
    },
    [],
  );

  const buildStakingInfo = useCallback(
    (plan: ILoanRunPlan, action: 'supply' | 'borrow'): IStakingInfo => {
      const { route: planRoute } = plan;
      const isLoan = action === 'borrow';
      const token = toIToken(isLoan ? planRoute.borrow : planRoute.collateral);
      const amount = isLoan ? plan.borrowAmount : plan.collateralAmount;
      return {
        label: isLoan ? EEarnLabels.Borrow : EEarnLabels.Supply,
        protocol: planRoute.marketLabel,
        protocolLogoURI: plan.marketLogoURI,
        ...(isLoan
          ? { receive: { token, amount } }
          : { send: { token, amount } }),
        tags: [
          EEarnLabels.Borrow,
          buildBorrowTag({ provider: planRoute.market.provider, action }),
        ],
      };
    },
    [],
  );

  // The collateral's approval when the allowance doesn't cover the amount;
  // USDT on Ethereum is set to zero first, as the Borrow form does
  const approveCollateral = useCallback(
    async (plan: ILoanRunPlan, signal: AbortSignal) => {
      const { route: planRoute } = plan;
      const token = toIToken(planRoute.collateral);
      const spenderAddress = resolveBorrowTokenApproveSpenderAddress({
        providerName: planRoute.market.provider,
        marketAddress: planRoute.market.marketAddress,
        tokenIsNative: token.isNative,
      });
      if (token.isNative || !spenderAddress) {
        return true;
      }
      const { allowanceParsed } =
        await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
          accountId: plan.networkAccountId,
          networkId: planRoute.market.networkId,
          spenderAddress,
          tokenAddress: token.address,
        });
      const allowance = new BigNumber(allowanceParsed || 0);
      if (allowance.gte(plan.collateralAmount)) {
        return true;
      }
      setHasApprovalStep(true);
      setPhase('approving');
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: plan.networkAccountId,
        networkId: planRoute.market.networkId,
      });
      const approveInfo = (amount: string): IApproveInfo => ({
        owner: account.address,
        spender: spenderAddress,
        amount,
        tokenInfo: { ...token, isNative: false },
      });
      const needsReset =
        allowance.gt(0) &&
        earnUtils.isUSDTonETHNetwork({
          networkId: planRoute.market.networkId,
          symbol: token.symbol,
        });
      const txid = await confirm({
        plan,
        approvesInfo: needsReset
          ? [approveInfo('0'), approveInfo(plan.collateralAmount)]
          : [approveInfo(plan.collateralAmount)],
      });
      if (!txid) {
        return false;
      }
      return waitForFinal(plan, txid, signal);
    },
    [confirm, waitForFinal],
  );

  const sendLoan = useCallback(
    async (plan: ILoanRunPlan, signal: AbortSignal) => {
      const { route: planRoute } = plan;
      const { market } = planRoute;
      const marketParams = {
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: planRoute.borrow.reserveAddress,
        accountId: plan.networkAccountId,
      };
      setPhase('borrowing');
      // An ETH loan on Aave comes through its gateway, which borrows on the
      // account's behalf once allowed to
      const isNativeLoan = shouldUseAaveNativeGateway({
        networkId: market.networkId,
        providerName: market.provider,
        reserveAddress: planRoute.borrow.reserveAddress,
      });
      if (isNativeLoan) {
        const page =
          await backgroundApiProxy.serviceStaking.getBorrowManagePage({
            ...marketParams,
            type: 'borrow',
          });
        if (new BigNumber(page.borrowAllowance ?? 0).lt(plan.borrowAmount)) {
          const resp =
            await backgroundApiProxy.serviceStaking.borrowBuildApproveDelegationTransaction(
              marketParams,
            );
          const txid = await confirm({
            plan,
            encodedTx: parseBorrowEncodedTx(resp.tx),
          });
          if (!txid || !(await waitForFinal(plan, txid, signal))) {
            return false;
          }
        }
      }
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildBorrowTransaction({
          ...marketParams,
          amount: plan.borrowAmount,
          ...(isNativeLoan ? { unwrap: true } : {}),
        });
      const stakingInfo = attachBorrowOrderId({
        stakingInfo: buildStakingInfo(plan, 'borrow'),
        orderId: resp.orderId,
      });
      const txid = await confirm({
        plan,
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        orderId: resp.orderId,
      });
      return Boolean(txid);
    },
    [buildStakingInfo, confirm, waitForFinal],
  );

  // The supply out and final, then the market's figures caught up with it
  const supplyCollateral = useCallback(
    async (plan: ILoanRunPlan, signal: AbortSignal) => {
      const { route: planRoute } = plan;
      const { market } = planRoute;
      const before = await readLoanRoutePosition({
        route: planRoute,
        networkAccountId: plan.networkAccountId,
      });
      setPhase('supplying');
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildSupplyTransaction({
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: planRoute.collateral.reserveAddress,
          accountId: plan.networkAccountId,
          amount: plan.collateralAmount,
        });
      const stakingInfo = attachBorrowOrderId({
        stakingInfo: buildStakingInfo(plan, 'supply'),
        orderId: resp.orderId,
      });
      const txid = await confirm({
        plan,
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        orderId: resp.orderId,
      });
      if (!txid) {
        return 'rejected' as const;
      }
      // From here the collateral is on its way: whatever happens next, the
      // loan is what's left, never a second supply
      pendingPlanRef.current = plan;
      setPhase('landing');
      if (!(await waitForFinal(plan, txid, signal))) {
        return 'pending' as const;
      }
      const expected = new BigNumber(before?.collateralSupplied ?? 0).plus(
        new BigNumber(plan.collateralAmount).times(0.999),
      );
      for (let attempt = 0; attempt < POSITION_SETTLE_ATTEMPTS; attempt += 1) {
        const position = await readLoanRoutePosition({
          route: planRoute,
          networkAccountId: plan.networkAccountId,
        });
        if (expected.lte(position?.collateralSupplied ?? 0)) {
          break;
        }
        await wait(POSITION_SETTLE_INTERVAL_MS, signal);
        if (signal.aborted) {
          throw new LoanRunStopped();
        }
      }
      return 'landed' as const;
    },
    [buildStakingInfo, confirm, waitForFinal],
  );

  const showError = useCallback(
    (error: unknown) => {
      if (error instanceof LoanRunStopped) {
        return;
      }
      Toast.error({
        title:
          (error instanceof Error && error.message) ||
          intl.formatMessage({ id: ETranslations.global_failed }),
      });
    },
    [intl],
  );

  const borrowAlone = useCallback(
    async (plan: ILoanRunPlan, supplied: boolean) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        if (await sendLoan(plan, controller.signal)) {
          pendingPlanRef.current = undefined;
          setPhase('done');
          onDoneRef.current({ plan, supplied });
          return;
        }
        pendingPlanRef.current = plan;
        setPhase(supplied ? 'borrowReady' : 'idle');
      } catch (error) {
        pendingPlanRef.current = plan;
        setPhase(supplied ? 'borrowReady' : 'idle');
        showError(error);
      }
    },
    [sendLoan, showError],
  );

  const start = useCallback(
    async (plan: ILoanRunPlan) => {
      if (phase !== 'idle') {
        return;
      }
      const hasCollateral = new BigNumber(plan.collateralAmount).gt(0);
      const riskAccepted = await ensureRiskAccepted({
        provider: plan.route.market.provider,
        symbol: hasCollateral
          ? plan.route.collateral.symbol
          : plan.route.borrow.symbol,
        networkId: plan.route.market.networkId,
      });
      if (!riskAccepted) {
        return;
      }
      if (!hasCollateral) {
        setHasApprovalStep(false);
        await borrowAlone(plan, false);
        return;
      }
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const { signal } = controller;
      setHasApprovalStep(false);
      pendingPlanRef.current = undefined;
      setPhase('preparing');
      try {
        if (!(await approveCollateral(plan, signal))) {
          setPhase('idle');
          return;
        }
        const supply = await supplyCollateral(plan, signal);
        if (supply === 'rejected') {
          setPhase('idle');
          return;
        }
        if (supply === 'pending') {
          setPhase('borrowReady');
          return;
        }
        await borrowAlone(plan, true);
      } catch (error) {
        // Before the supply went out nothing changed; after it, the loan is
        // what's left
        setPhase(pendingPlanRef.current === plan ? 'borrowReady' : 'idle');
        showError(error);
      }
    },
    [
      approveCollateral,
      borrowAlone,
      ensureRiskAccepted,
      phase,
      showError,
      supplyCollateral,
    ],
  );

  // The loan left over from a press whose supply went in
  const borrowPending = useCallback(async () => {
    const plan = pendingPlanRef.current;
    if (!plan || phase !== 'borrowReady') {
      return;
    }
    await borrowAlone(plan, true);
  }, [borrowAlone, phase]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    pendingPlanRef.current = undefined;
    setHasApprovalStep(false);
    setPhase('idle');
  }, []);

  return {
    phase,
    hasApprovalStep,
    pendingPlan: phase === 'borrowReady' ? pendingPlanRef.current : undefined,
    isRunning:
      phase === 'preparing' ||
      phase === 'approving' ||
      phase === 'supplying' ||
      phase === 'landing' ||
      phase === 'borrowing',
    start,
    borrowPending,
    reset,
  };
}
