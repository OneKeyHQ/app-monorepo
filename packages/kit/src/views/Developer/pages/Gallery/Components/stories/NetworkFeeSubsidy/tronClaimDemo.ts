import { useEffect, useState } from 'react';

import type { ITronClaimDemoScenario } from '@onekeyhq/shared/src/routes/testModal';

export type ITronDemoAccount = {
  id: string;
  name: string;
  address: string;
  activated: boolean;
  watching: boolean;
  monthRemaining: number;
  claimedAt?: number;
};

export type ITronClaimDemo = {
  accounts: ITronDemoAccount[];
  selectedAccountId: string;
  remaining: number;
  total: number;
  monthIPRemaining: number;
  failNextClaim: boolean;
};

export const TRON_RESOURCE_LIFETIME = 10 * 60 * 1000;

function getClaimDay(timestamp: number) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function createTronClaimDemo(
  scenario: ITronClaimDemoScenario = 'available',
): ITronClaimDemo {
  return {
    selectedAccountId: 'account-1',
    accounts:
      scenario === 'missingAccount'
        ? []
        : [
            {
              id: 'account-1',
              name: 'Account #1',
              address: 'TQ9w…3xP8',
              activated: scenario !== 'inactive',
              watching: scenario === 'watching',
              monthRemaining: scenario === 'monthlyLimit' ? 0 : 8,
              claimedAt:
                scenario === 'claimed' ? Date.now() - 60_000 : undefined,
            },
            {
              id: 'account-2',
              name: 'Account #2',
              address: 'TB6m…7nK2',
              activated: true,
              watching: false,
              monthRemaining: 6,
            },
          ],
    remaining: scenario === 'exhausted' ? 0 : 128,
    total: 500,
    monthIPRemaining: scenario === 'ipLimit' ? 0 : 6,
    failNextClaim: scenario === 'failed',
  };
}

export function getTronClaimStatus(state: ITronClaimDemo, now: number) {
  const account = state.accounts.find(
    (item) => item.id === state.selectedAccountId,
  );
  const claimedToday =
    account?.claimedAt !== undefined &&
    getClaimDay(account.claimedAt) === getClaimDay(now);
  const expiresAt =
    account?.claimedAt === undefined
      ? 0
      : account.claimedAt + TRON_RESOURCE_LIFETIME;
  let reason: string | undefined;
  if (!account) reason = '请先添加 TRON 账户。';
  else if (account.watching) reason = '观察账户不能领取资源，请选择其他账户。';
  else if (state.monthIPRemaining === 0)
    reason = '当前 IP 本月领取次数已达上限。';
  else if (account.monthRemaining === 0)
    reason = '当前地址本月领取次数已达上限。';
  else if (!account.activated)
    reason = '当前地址尚未激活，请先向该地址转入 TRX。';
  else if (state.remaining === 0 || state.total === 0)
    reason = '免费资源已领完，请稍后再来。';
  else if (claimedToday)
    reason = '当前地址今日已领取，请在 GMT+8 次日重置后再来。';

  let buttonText = '领取';
  if (claimedToday) buttonText = '已领取';
  if (state.remaining === 0 || state.total === 0) buttonText = '已领完';

  return {
    account,
    canClaim: !reason,
    claimedToday,
    reason,
    secondsLeft: Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    buttonText,
  };
}

// Local fixtures only. Successful claims never create a transaction or savings record.
export function claimTronDemo(
  state: ITronClaimDemo,
  now: number,
): ITronClaimDemo {
  if (!getTronClaimStatus(state, now).canClaim || state.failNextClaim)
    return state;
  return {
    ...state,
    remaining: state.remaining - 1,
    monthIPRemaining: state.monthIPRemaining - 1,
    accounts: state.accounts.map((account) =>
      account.id === state.selectedAccountId
        ? {
            ...account,
            monthRemaining: account.monthRemaining - 1,
            claimedAt: now,
          }
        : account,
    ),
  };
}

export function useTronClaimClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function formatResourceTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
