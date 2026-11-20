import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { createLateEarnOrderRecorder } from '@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IEarnFundingReceipt,
  IEarnFundingState,
} from '@onekeyhq/shared/types/earn/funding';
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
import { useCommittedEarnScopeGuard } from '../../../Staking/hooks/useCommittedEarnScopeGuard';
import { buildBorrowTag } from '../../../Staking/utils/utils';
import {
  completeEarnFunding,
  getEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  settleEarnFunding,
  useEarnFunding,
} from '../EarnRouter/earnFundingRegistry';

import {
  getLoanRunAfterSupply,
  hasLoanSupplySettled,
  loanFundingGroup,
  loanOperationKey,
  toLoanTxOutcome,
} from './loanRouter.utils';
import { readLoanRoutePosition } from './useLoanRouterFacts';

import type {
  ILoanRoute,
  ILoanRouterToken,
  ILoanSupplyOutcome,
  ILoanTxOutcome,
} from './loanRouter.utils';

// One press: the collateral's approval when it needs one, the supply, a wait
// for the supply to land, then the loan (after the delegation an ETH loan
// needs on Aave). Each step is a confirm of the wallet's own. Rejecting the
// supply, or its failing on chain, leaves everything as it was; rejecting
// the loan leaves the collateral supplied, and the form offers the loan
// alone. A plan without a loan ends once its supply has gone out

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
  fundingSource?: IEarnFundingReceipt;
};

export type ILoanRunDone = {
  plan: ILoanRunPlan;
  // Collateral went in on this press (none when only borrowing)
  supplied: boolean;
};

type ILoanExecutionPlan = ILoanRunPlan & {
  accountAddress: string;
  isCurrent: () => boolean;
};

type ILoanReservation = NonNullable<ReturnType<typeof reserveEarnFunding>>;

const LOAN_STOPPED = new OneKeyLocalError('Loan operation stopped');
const LOAN_UNKNOWN = new OneKeyLocalError(
  'Loan transaction outcome is unknown',
);

async function reserveLoanStep(
  plan: ILoanExecutionPlan,
  step: 'approval' | 'supply' | 'delegation' | 'borrow',
  options: { positionBefore?: string; source?: IEarnFundingReceipt } = {},
) {
  const key = loanOperationKey(plan, step);
  await refreshEarnFunding(key);
  const amount =
    step === 'borrow' || step === 'delegation'
      ? plan.borrowAmount
      : plan.collateralAmount;
  const group = loanFundingGroup({
    accountId: plan.networkAccountId,
    networkId: plan.route.market.networkId,
    address: plan.accountAddress,
    provider: plan.route.market.provider,
    marketAddress: plan.route.market.marketAddress,
  });
  const reservation = reserveEarnFunding(key, {
    amount,
    positionBefore: options.positionBefore,
    group,
    source: step === 'supply' ? plan.fundingSource : options.source,
  });
  if (!reservation) throw LOAN_UNKNOWN;
  return reservation;
}

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

async function assertLoanAccount(plan: ILoanExecutionPlan) {
  if (!plan.isCurrent()) {
    throw LOAN_STOPPED;
  }
  const matches = await isTaskAccountCurrent({
    accountId: plan.networkAccountId,
    networkId: plan.route.market.networkId,
    accountAddress: plan.accountAddress,
  });
  if (!matches || !plan.isCurrent()) {
    throw new OneKeyLocalError('Borrow transaction account changed');
  }
}

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
  const pendingPlanRef = useRef<ILoanExecutionPlan | undefined>(undefined);
  const completedRef = useRef<
    (IEarnFundingReceipt & { hasSource?: true }) | undefined
  >(undefined);
  const startingRef = useRef(false);
  const abortRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abortRef.current?.abort(), []);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const networkId = route?.market.networkId ?? '';
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      networkAccountId,
      networkId,
      route?.market.provider,
      route?.market.marketAddress,
      route?.collateral.reserveAddress,
      route?.borrow.reserveAddress,
    ]),
  );
  const { result: resolvedOwner } = usePromiseResult(async () => {
    if (!networkAccountId || !networkId) return undefined;
    const address = await getTaskAccountAddress({
      accountId: networkAccountId,
      networkId,
    });
    return { accountId: networkAccountId, networkId, address };
  }, [networkAccountId, networkId]);
  const ownerMatches =
    resolvedOwner?.accountId === networkAccountId &&
    resolvedOwner?.networkId === networkId;
  const ownerPlan = useMemo(
    () =>
      route && networkAccountId && ownerMatches && resolvedOwner
        ? {
            route,
            networkAccountId,
            accountAddress: resolvedOwner.address,
            collateralAmount: '',
            borrowAmount: '',
            isCurrent: () => true,
          }
        : undefined,
    [route, networkAccountId, ownerMatches, resolvedOwner],
  );
  const approvalKey = ownerPlan
    ? loanOperationKey(ownerPlan, 'approval')
    : undefined;
  const supplyKey = ownerPlan
    ? loanOperationKey(ownerPlan, 'supply')
    : undefined;
  const delegationKey = ownerPlan
    ? loanOperationKey(ownerPlan, 'delegation')
    : undefined;
  const borrowKey = ownerPlan
    ? loanOperationKey(ownerPlan, 'borrow')
    : undefined;
  const approvalFunding = useEarnFunding(approvalKey);
  const supplyFunding = useEarnFunding(supplyKey);
  const delegationFunding = useEarnFunding(delegationKey);
  const borrowFunding = useEarnFunding(borrowKey);
  const [isRechecking, setIsRechecking] = useState(false);
  useEffect(() => {
    abortRef.current?.abort();
    pendingPlanRef.current = undefined;
    setHasApprovalStep(false);
    setPhase('idle');
    setIsRechecking(false);
  }, [
    networkAccountId,
    networkId,
    route?.market.provider,
    route?.market.marketAddress,
    route?.collateral.reserveAddress,
    route?.borrow.reserveAddress,
  ]);
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
      reservation,
    }: {
      plan: ILoanExecutionPlan;
      encodedTx?: IEncodedTx;
      approvesInfo?: IApproveInfo[];
      stakingInfo?: IStakingInfo;
      orderId?: string;
      reservation: ILoanReservation;
    }) =>
      new Promise<string | undefined>((resolve, reject) => {
        const recordLateOrder = createLateEarnOrderRecorder();
        let isSettled = false;
        let sendObserved = false;
        let confirmationClosed = false;
        const settle = (txid?: string) => {
          if (!isSettled) {
            isSettled = true;
            resolve(txid);
          }
        };
        const uncertain = () => {
          if (!isSettled) {
            isSettled = true;
            reject(LOAN_UNKNOWN);
          }
        };
        const failBeforeSend = (error: unknown) => {
          confirmationClosed = true;
          void reservation.release().then(() => {
            if (!isSettled) {
              isSettled = true;
              reject(error);
            }
          }, uncertain);
        };
        void navigationToTxConfirm({
          encodedTx,
          approvesInfo,
          stakingInfo,
          isNavigationCurrent: plan.isCurrent,
          onBeforeSend: async () => {
            await assertLoanAccount(plan);
            if (confirmationClosed) throw LOAN_STOPPED;
            await reservation.markUnknown();
            await assertLoanAccount(plan);
            if (confirmationClosed) {
              await reservation.release();
              throw LOAN_STOPPED;
            }
            sendObserved = true;
          },
          onSuccess: (data) => {
            const txid = getSentTxid(data);
            if (txid) {
              void reservation
                .markSubmitted(txid)
                .then(() => settle(txid), uncertain);
            } else {
              void reservation.markUnknown().then(uncertain, uncertain);
            }
            if (encodedTx && stakingInfo) {
              void handleBorrowSuccess({
                data,
                orderId,
                networkId: plan.route.market.networkId,
                accountId: plan.networkAccountId,
                expectedAccountAddress: plan.accountAddress,
                stakingInfo,
                canNotify: async () => {
                  try {
                    await assertLoanAccount(plan);
                    return true;
                  } catch {
                    return false;
                  }
                },
              }).catch(() => undefined);
            }
          },
          onLateBroadcastAccepted: async (fact) => {
            if (
              fact.accountId !== plan.networkAccountId ||
              fact.networkId !== plan.route.market.networkId ||
              !fact.txid
            ) {
              return;
            }
            await reservation.markSubmitted(fact.txid);
            if (stakingInfo) {
              await recordLateOrder({
                fact,
                accountId: plan.networkAccountId,
                networkId: plan.route.market.networkId,
                stakeInfo: stakingInfo,
                orderId,
              });
            }
          },
          onFail: failBeforeSend,
          onConfirmationFail: () => {
            sendObserved = true;
            void reservation.markUnknown().then(uncertain, uncertain);
          },
          onSafePreSendFail: () => {
            void reservation.release().then(() => settle(undefined), uncertain);
          },
          onCancel: () => {
            confirmationClosed = true;
            if (sendObserved) uncertain();
            else
              void reservation
                .release()
                .then(() => settle(undefined), uncertain);
          },
        })
          .then(() => {
            if (!plan.isCurrent() && !sendObserved) {
              confirmationClosed = true;
              void reservation
                .release()
                .then(() => settle(undefined), uncertain);
            }
          })
          .catch((error: unknown) => {
            if (sendObserved) uncertain();
            else failBeforeSend(error);
          });
      }),
    [navigationToTxConfirm],
  );

  // Without a transaction ID, finality cannot be established.
  const waitForFinal = useCallback(
    async (
      plan: ILoanExecutionPlan,
      txid: string,
      signal: AbortSignal,
    ): Promise<ILoanTxOutcome> => {
      if (!txid) return 'pending';
      const status = await waitForTxFinalStatus({
        accountId: plan.networkAccountId,
        networkId: plan.route.market.networkId,
        expectedAccountAddress: plan.accountAddress,
        txid,
        signal,
      });
      if (signal.aborted) {
        throw LOAN_STOPPED;
      }
      return toLoanTxOutcome(status);
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
    async (plan: ILoanExecutionPlan, signal: AbortSignal) => {
      const { route: planRoute } = plan;
      const token = toIToken(planRoute.collateral);
      const spenderAddress = resolveBorrowTokenApproveSpenderAddress({
        providerName: planRoute.market.provider,
        marketAddress: planRoute.market.marketAddress,
        tokenIsNative: token.isNative,
      });
      if (token.isNative) return true;
      if (!spenderAddress)
        throw new OneKeyLocalError('Missing approval target');
      await assertLoanAccount(plan);
      const { allowanceParsed } =
        await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
          accountId: plan.networkAccountId,
          networkId: planRoute.market.networkId,
          spenderAddress,
          tokenAddress: token.address,
          expectedAccountAddress: plan.accountAddress,
        });
      await assertLoanAccount(plan);
      const allowance = new BigNumber(allowanceParsed ?? '');
      if (!allowance.isFinite() || allowance.lt(0)) {
        throw new OneKeyLocalError('Unable to verify the token allowance');
      }
      if (allowance.gte(plan.collateralAmount)) {
        return true;
      }
      setHasApprovalStep(true);
      setPhase('approving');
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: plan.networkAccountId,
        networkId: planRoute.market.networkId,
      });
      await assertLoanAccount(plan);
      if (
        !isTaskAccountAddress(
          {
            networkId: planRoute.market.networkId,
            accountAddress: plan.accountAddress,
          },
          account.address,
        )
      ) {
        throw new OneKeyLocalError('Borrow transaction account changed');
      }
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
      const amounts = needsReset
        ? ['0', plan.collateralAmount]
        : [plan.collateralAmount];
      for (const amount of amounts) {
        await assertLoanAccount(plan);
        const reservation = await reserveLoanStep(plan, 'approval');
        const txid = await confirm({
          plan,
          reservation,
          approvesInfo: [approveInfo(amount)],
        });
        if (!txid) return false;
        const outcome = await waitForFinal(plan, txid, signal);
        if (outcome === 'pending') throw LOAN_UNKNOWN;
        await releaseEarnFunding(loanOperationKey(plan, 'approval'), txid);
        if (outcome !== 'landed') return false;
      }
      return true;
    },
    [confirm, waitForFinal],
  );

  const sendLoan = useCallback(
    async (
      plan: ILoanExecutionPlan,
      signal: AbortSignal,
      source?: IEarnFundingReceipt,
    ) => {
      const { route: planRoute } = plan;
      const { market } = planRoute;
      const marketParams = {
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: planRoute.borrow.reserveAddress,
        accountId: plan.networkAccountId,
        expectedAccountAddress: plan.accountAddress,
      };
      await assertLoanAccount(plan);
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
          const encodedTx = parseBorrowEncodedTx(resp.tx);
          const delegation = await reserveLoanStep(plan, 'delegation');
          const txid = await confirm({
            plan,
            encodedTx,
            reservation: delegation,
          });
          if (!txid) return false;
          const outcome = await waitForFinal(plan, txid, signal);
          if (outcome === 'pending') throw LOAN_UNKNOWN;
          await releaseEarnFunding(loanOperationKey(plan, 'delegation'), txid);
          if (outcome !== 'landed') return false;
        }
      }
      const reservation = await reserveLoanStep(plan, 'borrow', { source });
      let resp;
      let encodedTx;
      try {
        resp =
          await backgroundApiProxy.serviceStaking.borrowBuildBorrowTransaction({
            ...marketParams,
            amount: plan.borrowAmount,
            ...(isNativeLoan ? { unwrap: true } : {}),
          });
        encodedTx = parseBorrowEncodedTx(resp.tx);
      } catch (error) {
        await reservation.release();
        throw error;
      }
      const stakingInfo = attachBorrowOrderId({
        stakingInfo: buildStakingInfo(plan, 'borrow'),
        orderId: resp.orderId,
      });
      const txid = await confirm({
        plan,
        encodedTx,
        stakingInfo,
        orderId: resp.orderId,
        reservation,
      });
      if (!txid) return false;
      const outcome = await waitForFinal(plan, txid, signal);
      if (outcome === 'pending') throw LOAN_UNKNOWN;
      if (outcome === 'failed') {
        await releaseEarnFunding(loanOperationKey(plan, 'borrow'), txid);
        return false;
      }
      await reservation.markFunded(plan.borrowAmount);
      return true;
    },
    [buildStakingInfo, confirm, waitForFinal],
  );

  // The supply out and final, then the market's figures caught up with it
  const supplyCollateral = useCallback(
    async (
      plan: ILoanExecutionPlan,
      signal: AbortSignal,
    ): Promise<ILoanSupplyOutcome> => {
      const { route: planRoute } = plan;
      const { market } = planRoute;
      await assertLoanAccount(plan);
      const existing = await refreshEarnFunding(
        loanOperationKey(plan, 'supply'),
      );
      if (existing?.status === 'funded') {
        if (!new BigNumber(existing.receivedAmount).eq(plan.collateralAmount)) {
          throw LOAN_UNKNOWN;
        }
        pendingPlanRef.current = plan;
        await completeEarnFunding(
          loanOperationKey(plan, 'supply'),
          existing.txId,
          { keepDestination: true },
        );
        return 'landed';
      }
      if (existing) return 'pending';
      const before = await readLoanRoutePosition({
        route: planRoute,
        networkAccountId: plan.networkAccountId,
      });
      if (before?.collateralSupplied === undefined) {
        throw new OneKeyLocalError('Unable to verify the collateral position');
      }
      setPhase('supplying');
      const reservation = await reserveLoanStep(plan, 'supply', {
        positionBefore: before.collateralSupplied,
      });
      let resp;
      let encodedTx;
      try {
        resp =
          await backgroundApiProxy.serviceStaking.borrowBuildSupplyTransaction({
            networkId: market.networkId,
            provider: market.provider,
            marketAddress: market.marketAddress,
            reserveAddress: planRoute.collateral.reserveAddress,
            accountId: plan.networkAccountId,
            expectedAccountAddress: plan.accountAddress,
            amount: plan.collateralAmount,
          });
        encodedTx = parseBorrowEncodedTx(resp.tx);
      } catch (error) {
        await reservation.release();
        throw error;
      }
      const stakingInfo = attachBorrowOrderId({
        stakingInfo: buildStakingInfo(plan, 'supply'),
        orderId: resp.orderId,
      });
      const txid = await confirm({
        plan,
        encodedTx,
        stakingInfo,
        orderId: resp.orderId,
        reservation,
      });
      if (!txid) {
        return 'rejected';
      }
      // From here the collateral is on its way: unless it fails on chain,
      // the loan is what's left, never a second supply
      pendingPlanRef.current = plan;
      setPhase('landing');
      const outcome = await waitForFinal(plan, txid, signal);
      if (outcome !== 'landed') {
        if (outcome === 'failed') {
          await releaseEarnFunding(loanOperationKey(plan, 'supply'), txid);
        }
        return outcome;
      }
      let positionSettled = false;
      for (let attempt = 0; attempt < POSITION_SETTLE_ATTEMPTS; attempt += 1) {
        const position = await readLoanRoutePosition({
          route: planRoute,
          networkAccountId: plan.networkAccountId,
        });
        if (
          hasLoanSupplySettled({
            before: before.collateralSupplied,
            amount: plan.collateralAmount,
            current: position?.collateralSupplied,
          })
        ) {
          positionSettled = true;
          break;
        }
        await wait(POSITION_SETTLE_INTERVAL_MS, signal);
        if (signal.aborted) {
          throw LOAN_STOPPED;
        }
      }
      if (!positionSettled) return 'pending';
      await reservation.markFunded(plan.collateralAmount);
      if (
        getEarnFunding(loanOperationKey(plan, 'supply'))?.status !== 'funded'
      ) {
        throw LOAN_UNKNOWN;
      }
      await completeEarnFunding(loanOperationKey(plan, 'supply'), txid, {
        keepDestination: true,
      });
      return 'landed';
    },
    [buildStakingInfo, confirm, waitForFinal],
  );

  const showError = useCallback(
    (error: unknown) => {
      if (error === LOAN_STOPPED) {
        return;
      }
      Toast.error({
        title:
          error === LOAN_UNKNOWN
            ? intl.formatMessage({
                id: ETranslations.earn_pending_transactions_data_out_of_sync,
              })
            : (error instanceof Error && error.message) ||
              intl.formatMessage({ id: ETranslations.global_failed }),
      });
    },
    [intl],
  );

  // A transaction that went out and failed on chain
  const showTxFailed = useCallback(() => {
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.swap_review_transaction_failed,
      }),
    });
  }, [intl]);

  const finish = useCallback(
    async (plan: ILoanExecutionPlan, supplied: boolean) => {
      const supplyScope = loanOperationKey(plan, 'supply');
      const borrowScope = loanOperationKey(plan, 'borrow');
      const borrowed = new BigNumber(plan.borrowAmount).gt(0);
      const operationScope = borrowed ? borrowScope : supplyScope;
      const record = await refreshEarnFunding(operationScope);
      if (
        record?.status !== 'funded' ||
        !new BigNumber(record.receivedAmount).eq(
          borrowed ? plan.borrowAmount : plan.collateralAmount,
        )
      )
        throw LOAN_UNKNOWN;
      if (!plan.isCurrent()) return;
      completedRef.current = {
        scope: operationScope,
        txId: record.txId,
        hasSource: record.source ? true : undefined,
      };
      pendingPlanRef.current = undefined;
      setPhase('done');
      onDoneRef.current({ plan, supplied });
    },
    [],
  );

  const restoreBorrow = useCallback(
    async (
      plan: ILoanExecutionPlan,
      borrow: Extract<IEarnFundingState, { status: 'funded' }>,
    ) => {
      const selectedSupplyScope = loanOperationKey(plan, 'supply');
      const supply =
        borrow.source?.scope === selectedSupplyScope
          ? await refreshEarnFunding(selectedSupplyScope)
          : undefined;
      const supplied =
        supply?.status === 'funded' && supply.txId === borrow.source?.txId;
      await finish(
        {
          ...plan,
          collateralAmount: supplied ? supply.receivedAmount : '0',
          borrowAmount: borrow.receivedAmount,
        },
        supplied,
      );
    },
    [finish],
  );

  const acknowledgeDone = useCallback(async () => {
    const completed = completedRef.current;
    if (!completed) return true;
    try {
      if (completed.hasSource) {
        const cleared = await completeEarnFunding(
          completed.scope,
          completed.txId,
        );
        if (!cleared) {
          const current = await refreshEarnFunding(completed.scope);
          if (current?.status === 'funded' && current.txId === completed.txId)
            throw LOAN_UNKNOWN;
        }
      } else {
        await releaseEarnFunding(completed.scope, completed.txId, 'funded');
      }
      if (completedRef.current === completed) completedRef.current = undefined;
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }, [showError]);

  useEffect(() => {
    if (
      !ownerPlan ||
      phase !== 'idle' ||
      startingRef.current ||
      completedRef.current ||
      borrowFunding?.status !== 'funded'
    )
      return;
    const isCurrent = scope.capture();
    void restoreBorrow({ ...ownerPlan, isCurrent }, borrowFunding).catch(
      (error: unknown) => {
        if (isCurrent()) showError(error);
      },
    );
  }, [borrowFunding, ownerPlan, phase, restoreBorrow, scope, showError]);

  const borrowAlone = useCallback(
    async (plan: ILoanExecutionPlan, supplied: boolean) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      let retryPlan = plan;
      try {
        const supplyScope = loanOperationKey(plan, 'supply');
        const supply = supplied
          ? await refreshEarnFunding(supplyScope)
          : undefined;
        if (supplied && supply?.status !== 'funded') throw LOAN_UNKNOWN;
        if (supply?.status === 'funded' && supply.source) {
          await completeEarnFunding(supplyScope, supply.txId, {
            keepDestination: true,
          });
        }
        const source =
          supply?.status === 'funded'
            ? { scope: supplyScope, txId: supply.txId }
            : undefined;
        if (supply?.status === 'funded') {
          retryPlan = { ...plan, collateralAmount: supply.receivedAmount };
        }
        if (await sendLoan(plan, controller.signal, source)) {
          await finish(retryPlan, supplied);
          return;
        }
        if (!plan.isCurrent()) return;
        pendingPlanRef.current = retryPlan;
        setPhase(supplied ? 'borrowReady' : 'idle');
      } catch (error) {
        if (!plan.isCurrent()) return;
        pendingPlanRef.current = retryPlan;
        const pendingBorrow = getEarnFunding(loanOperationKey(plan, 'borrow'));
        const pendingDelegation = getEarnFunding(
          loanOperationKey(plan, 'delegation'),
        );
        if (error === LOAN_UNKNOWN || pendingBorrow || pendingDelegation) {
          setPhase('landing');
        } else {
          setPhase(supplied ? 'borrowReady' : 'idle');
        }
        showError(error);
      }
    },
    [finish, sendLoan, showError],
  );

  const start = useCallback(
    async (plan: ILoanRunPlan) => {
      if (phase !== 'idle' || startingRef.current) {
        return;
      }
      startingRef.current = true;
      const isCurrent = scope.capture();
      let securedPlan: ILoanExecutionPlan;
      try {
        const accountAddress = await getTaskAccountAddress({
          accountId: plan.networkAccountId,
          networkId: plan.route.market.networkId,
        });
        securedPlan = { ...plan, accountAddress, isCurrent };
        await assertLoanAccount(securedPlan);
      } catch (error) {
        startingRef.current = false;
        if (isCurrent()) showError(error);
        return;
      }
      const hasCollateral = new BigNumber(securedPlan.collateralAmount).gt(0);
      const hasLoan = new BigNumber(securedPlan.borrowAmount).gt(0);
      let riskAccepted: boolean;
      try {
        riskAccepted = await ensureRiskAccepted({
          provider: securedPlan.route.market.provider,
          symbol: hasCollateral
            ? securedPlan.route.collateral.symbol
            : securedPlan.route.borrow.symbol,
          networkId: securedPlan.route.market.networkId,
        });
        await assertLoanAccount(securedPlan);
      } catch (error) {
        startingRef.current = false;
        if (isCurrent()) showError(error);
        return;
      }
      if (!riskAccepted) {
        startingRef.current = false;
        return;
      }
      try {
        const steps = ['approval', 'supply', 'delegation', 'borrow'] as const;
        const states = await Promise.all(
          steps.map((step) =>
            refreshEarnFunding(loanOperationKey(securedPlan, step)),
          ),
        );
        await assertLoanAccount(securedPlan);
        if (states[3]?.status === 'funded') {
          await restoreBorrow(securedPlan, states[3]);
          startingRef.current = false;
          return;
        }
        if (states.some((state) => state && state.status !== 'funded')) {
          pendingPlanRef.current = securedPlan;
          setPhase('landing');
          startingRef.current = false;
          return;
        }
      } catch (error) {
        startingRef.current = false;
        if (isCurrent()) showError(error);
        return;
      }
      if (!hasCollateral) {
        setHasApprovalStep(false);
        try {
          const priorSupply = await refreshEarnFunding(
            loanOperationKey(securedPlan, 'supply'),
          );
          if (priorSupply && priorSupply.status !== 'funded') {
            pendingPlanRef.current = securedPlan;
            setPhase('landing');
            return;
          }
          if (priorSupply?.status === 'funded')
            await completeEarnFunding(
              loanOperationKey(securedPlan, 'supply'),
              priorSupply.txId,
              { keepDestination: true },
            );
          await borrowAlone(securedPlan, priorSupply?.status === 'funded');
        } catch (error) {
          if (isCurrent()) showError(error);
        } finally {
          startingRef.current = false;
        }
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
        const existingSupply = await refreshEarnFunding(
          loanOperationKey(securedPlan, 'supply'),
        );
        if (existingSupply && existingSupply.status !== 'funded') {
          throw LOAN_UNKNOWN;
        }
        if (
          !existingSupply &&
          !(await approveCollateral(securedPlan, signal))
        ) {
          if (isCurrent()) setPhase('idle');
          return;
        }
        const supply = await supplyCollateral(securedPlan, signal);
        if (!isCurrent()) return;
        const next = getLoanRunAfterSupply({ outcome: supply, hasLoan });
        if (next === 'idle') {
          setPhase('idle');
          return;
        }
        if (next === 'failed') {
          pendingPlanRef.current = undefined;
          setPhase('idle');
          showTxFailed();
          return;
        }
        if (next === 'pending') {
          setPhase('landing');
          return;
        }
        if (next === 'done') {
          await finish(securedPlan, true);
          return;
        }
        if (next === 'borrowReady') {
          setPhase('borrowReady');
          return;
        }
        await borrowAlone(securedPlan, true);
      } catch (error) {
        if (!isCurrent()) return;
        if (error === LOAN_UNKNOWN) {
          pendingPlanRef.current = securedPlan;
          setPhase('landing');
          return;
        }
        // Once the supply was sent, an interrupted observation cannot prove
        // it landed; retain it instead of advancing to borrowing or success.
        const isOut = pendingPlanRef.current === securedPlan;
        setPhase(isOut ? 'landing' : 'idle');
        showError(error);
      } finally {
        startingRef.current = false;
      }
    },
    [
      approveCollateral,
      borrowAlone,
      ensureRiskAccepted,
      finish,
      phase,
      restoreBorrow,
      scope,
      showError,
      showTxFailed,
      supplyCollateral,
    ],
  );

  const reconcile = useCallback(async () => {
    if (!ownerPlan) return;
    const isCurrent = scope.capture();
    const plan = { ...ownerPlan, isCurrent };
    const controller = new AbortController();
    setIsRechecking(true);
    try {
      await assertLoanAccount(plan);
      const existingBorrow = await refreshEarnFunding(
        loanOperationKey(plan, 'borrow'),
      );
      if (existingBorrow?.status === 'funded') {
        await restoreBorrow(plan, existingBorrow);
        return;
      }
      const reconcileStep = async (
        step: 'approval' | 'supply' | 'delegation' | 'borrow',
      ) => {
        const key = loanOperationKey(plan, step);
        const record = await refreshEarnFunding(key);
        if (record?.status !== 'submitted') return;
        const outcome = await waitForFinal(
          plan,
          record.txId,
          controller.signal,
        );
        await assertLoanAccount(plan);
        if (outcome === 'pending') return;
        if (outcome === 'landed' && step === 'borrow' && record.intentAmount) {
          await settleEarnFunding(key, record.txId, record.intentAmount);
          const borrow = await refreshEarnFunding(key);
          if (borrow?.status !== 'funded') throw LOAN_UNKNOWN;
          await restoreBorrow(plan, borrow);
          return true;
        }
        if (
          outcome === 'failed' ||
          step === 'approval' ||
          step === 'delegation'
        ) {
          await releaseEarnFunding(key, record.txId);
          return;
        }
        if (step !== 'supply') return;
        const position = await readLoanRoutePosition({
          route: plan.route,
          networkAccountId: plan.networkAccountId,
        });
        if (
          hasLoanSupplySettled({
            before: record.positionBefore,
            amount: record.intentAmount,
            current: position?.collateralSupplied,
          }) &&
          record.intentAmount
        ) {
          await settleEarnFunding(key, record.txId, record.intentAmount);
          await completeEarnFunding(key, record.txId, {
            keepDestination: true,
          });
        }
      };
      for (const step of [
        'approval',
        'supply',
        'delegation',
        'borrow',
      ] as const) {
        if (await reconcileStep(step)) return;
      }
      if (isCurrent()) setPhase('idle');
    } catch (error) {
      if (isCurrent()) showError(error);
    } finally {
      if (isCurrent()) setIsRechecking(false);
    }
  }, [ownerPlan, restoreBorrow, scope, showError, waitForFinal]);

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
    fundedSupplyAmount:
      supplyFunding?.status === 'funded'
        ? supplyFunding.receivedAmount
        : undefined,
    canReconcile:
      (phase === 'landing' && borrowFunding?.status === 'funded') ||
      [approvalFunding, supplyFunding, delegationFunding, borrowFunding].some(
        (item) => item?.status === 'submitted',
      ),
    isRechecking,
    acknowledgeDone,
    reconcile,
    pendingPlan: phase === 'borrowReady' ? pendingPlanRef.current : undefined,
    isRunning:
      phase === 'preparing' ||
      phase === 'approving' ||
      phase === 'supplying' ||
      phase === 'landing' ||
      phase === 'borrowing' ||
      borrowFunding?.status === 'funded' ||
      [approvalFunding, supplyFunding, delegationFunding, borrowFunding].some(
        (item) => item && item.status !== 'funded',
      ),
    start,
    borrowPending,
    reset,
  };
}
