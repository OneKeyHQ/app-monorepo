import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

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
      balanceState: 'zero' | 'positive';
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
          : undefined,
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
  ownerToken,
  shell,
}: {
  ownerToken?: IHomeRuntimeOwnerToken;
  shell: IHomeShellSemanticModel;
}): IHomeBalancePresentation {
  const presentation = adaptHomeShellToReactHeader(shell);
  const revision = stringUtils.stableStringify({ ownerToken, shell });
  if ('balance' in presentation && presentation.balance) {
    return {
      balanceState: presentation.balanceState,
      correlated: {
        kind: 'ready',
        balance: presentation.balance,
        balanceState: presentation.balanceState,
        revision,
        showPositiveBanner: presentation.showPositiveBanner,
      },
    };
  }
  const balanceState =
    presentation.balanceState === 'positive' ? 'positive' : 'unknown';
  return {
    balanceState,
    correlated: {
      kind: 'loading',
      balanceState,
      revision,
      showPositiveBanner: presentation.showPositiveBanner,
    },
  };
}

function resolveHomeOverviewBalanceRenderDecision({
  balancePresentation,
  semanticDisplayAmount,
}: {
  balancePresentation?: IHomeCorrelatedBalancePresentation;
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
