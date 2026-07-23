import { useHomeFacts, useHomeShell } from '../states/jotai/contexts/home';
import { resolveHomeBalancePresentation } from '../views/Home/model/compatibility/homeShellRenderAdapter';

import type { IHomeBalancePresentation } from '../views/Home/model/compatibility/homeShellRenderAdapter';

export type {
  IHomeBalancePresentation,
  IHomeCorrelatedBalancePresentation,
} from '../views/Home/model/compatibility/homeShellRenderAdapter';

export type IHomeBalanceState = 'unknown' | 'zero' | 'positive';

export function resolveHomeBalanceState({
  hasWallet,
  hasHoldings,
  balanceIsPositive,
}: {
  hasWallet: boolean;
  hasHoldings: boolean;
  balanceIsPositive: boolean | undefined;
}): IHomeBalanceState {
  if (!hasWallet) return 'unknown';
  if (hasHoldings) return 'positive';
  if (balanceIsPositive === undefined) return 'unknown';
  return balanceIsPositive ? 'positive' : 'zero';
}

export function useHomeBalancePresentation(): IHomeBalancePresentation {
  const facts = useHomeFacts();
  const shell = useHomeShell();
  return resolveHomeBalancePresentation({
    fallbackCurrency:
      facts?.balance?.quoteBasis.currency ?? facts?.environment.currency,
    ownerToken: facts?.ownerToken,
    shell: shell.value,
  });
}

export function useHomeBalanceState(): IHomeBalanceState {
  return useHomeBalancePresentation().balanceState;
}
