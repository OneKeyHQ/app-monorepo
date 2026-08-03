import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import {
  type IHomeBalanceDisplayPresentation,
  projectHomeDisplayModel,
} from '../policies/homeDisplayModelPolicy';

import type {
  IHomeMoneyViewModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';
type IHomeReactShellPresentation =
  | {
      actionFamily: 'loading';
      balanceState: 'unknown';
      showPositiveBanner: false;
    }
  | {
      actionFamily: 'zero';
      balance: IHomeMoneyViewModel;
      balanceState: 'zero';
      showPositiveBanner: false;
    }
  | {
      actionFamily: 'funded';
      balance?: IHomeMoneyViewModel;
      balanceState: 'positive';
      showPositiveBanner: boolean;
    };

type IHomeCorrelatedBalancePresentation =
  | {
      kind: 'loading';
      balanceState: 'unknown' | 'positive';
      revision: string;
      showPositiveBanner: boolean;
    }
  | {
      kind: 'ready';
      balance: IHomeMoneyViewModel;
      balanceState: 'unknown' | 'zero' | 'positive';
      revision: string;
      showPositiveBanner: boolean;
    };

type IHomeBalancePresentation = {
  balanceState: 'unknown' | 'zero' | 'positive';
  correlated: IHomeCorrelatedBalancePresentation;
};

type IHomeOverviewBalanceRenderDecision = {
  amount?: string;
  revision?: string;
  showSkeleton: boolean;
};

function adaptHomeShellToReactHeader(
  shell: IHomeShellSemanticModel,
): IHomeReactShellPresentation {
  if (shell.kind !== 'portfolio') {
    return {
      actionFamily: 'loading',
      balanceState: 'unknown',
      showPositiveBanner: false,
    };
  }
  const { presentation } = shell;
  if (presentation.kind === 'zero') {
    return {
      actionFamily: 'zero',
      balance: presentation.header.balance,
      balanceState: 'zero',
      showPositiveBanner: false,
    };
  }
  if (
    presentation.kind === 'funded' ||
    presentation.kind === 'fundedPendingTotal'
  ) {
    return {
      actionFamily: 'funded',
      balance:
        presentation.kind === 'funded'
          ? presentation.header.balance
          : presentation.header.balance,
      balanceState: 'positive',
      showPositiveBanner: presentation.banner.kind === 'positive',
    };
  }
  return {
    actionFamily: 'loading',
    balanceState: 'unknown',
    showPositiveBanner: false,
  };
}

function resolveHomeBalancePresentation({
  fallbackCurrency,
  ownerToken,
  shell,
}: {
  fallbackCurrency?: string;
  ownerToken?: IHomeRuntimeOwnerToken;
  shell: IHomeShellSemanticModel;
}): IHomeBalancePresentation {
  const display = projectHomeDisplayModel({
    fallbackCurrency,
    ownerToken,
    shell,
  });
  const balanceState =
    display.fundingVerdict === 'funded' ? 'positive' : display.fundingVerdict;
  const showPositiveBanner = display.banner.kind === 'eligible';
  if (display.balance.kind === 'ready') {
    return {
      balanceState,
      correlated: {
        kind: 'ready',
        balance: display.balance.balance,
        balanceState,
        revision: display.balance.revision,
        showPositiveBanner,
      },
    };
  }
  return {
    balanceState,
    correlated: {
      kind: 'loading',
      balanceState: balanceState === 'zero' ? 'unknown' : balanceState,
      revision: display.balance.revision,
      showPositiveBanner,
    },
  };
}

function resolveHomeOverviewBalanceRenderDecision({
  balancePresentation,
  semanticDisplayAmount,
}: {
  balancePresentation?:
    | IHomeBalanceDisplayPresentation
    | IHomeCorrelatedBalancePresentation;
  semanticDisplayAmount?: string;
}): IHomeOverviewBalanceRenderDecision {
  if (!balancePresentation) {
    return { showSkeleton: true };
  }
  if (
    balancePresentation.kind === 'loading' ||
    semanticDisplayAmount === undefined
  ) {
    return {
      revision: balancePresentation.revision,
      showSkeleton: true,
    };
  }
  return {
    amount: semanticDisplayAmount,
    revision: balancePresentation.revision,
    showSkeleton: false,
  };
}

export {
  adaptHomeShellToReactHeader,
  resolveHomeBalancePresentation,
  resolveHomeOverviewBalanceRenderDecision,
};
export type {
  IHomeBalancePresentation,
  IHomeCorrelatedBalancePresentation,
  IHomeOverviewBalanceRenderDecision,
  IHomeReactShellPresentation,
};
