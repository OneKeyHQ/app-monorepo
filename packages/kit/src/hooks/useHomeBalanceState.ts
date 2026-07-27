import { useMemo } from 'react';

import { useHomeFacts, useHomeShell } from '../states/jotai/contexts/home';
import { resolveHomeBalancePresentation } from '../views/Home/model/compatibility/homeShellRenderAdapter';
import { projectHomeDisplayModel } from '../views/Home/model/policies/homeDisplayModelPolicy';

import type { IHomeBalancePresentation } from '../views/Home/model/compatibility/homeShellRenderAdapter';
import type { IHomeDisplayModel } from '../views/Home/model/policies/homeDisplayModelPolicy';

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
    ownerToken: facts?.ownerToken,
    shell: shell.value,
  });
}

export function useHomeDisplayModel(): IHomeDisplayModel {
  const facts = useHomeFacts();
  const shell = useHomeShell();
  const ownerToken = facts?.ownerToken;
  return useMemo(
    () =>
      projectHomeDisplayModel({
        ownerToken,
        shell: shell.value,
      }),
    [ownerToken, shell.value],
  );
}

export function useHomeBalanceState(): IHomeBalanceState {
  const verdict = useHomeDisplayModel().fundingVerdict;
  return verdict === 'funded' ? 'positive' : verdict;
}
