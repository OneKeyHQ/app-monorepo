import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeMoneyViewModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';

type IHomeLegacyShellPresentation =
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
  correlated?: IHomeCorrelatedBalancePresentation;
};

type IHomeOverviewBalanceRenderDecision = {
  amount?: string;
  revision?: string;
  showSkeleton: boolean;
};

function adaptHomeShellToLegacy(
  shell: IHomeShellSemanticModel,
): IHomeLegacyShellPresentation {
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

function resolveHomeLegacyBalanceState({
  legacyState,
  shadowFactsPresent,
  shell,
}: {
  legacyState: 'unknown' | 'zero' | 'positive';
  shadowFactsPresent: boolean;
  shell: IHomeShellSemanticModel | undefined;
}): 'unknown' | 'zero' | 'positive' {
  if (shell) {
    return adaptHomeShellToLegacy(shell).balanceState;
  }
  return shadowFactsPresent ? 'unknown' : legacyState;
}

function resolveHomeBalancePresentation({
  legacyState,
  ownerToken,
  semanticPresentationEnabled = true,
  shadowFactsPresent,
  shell,
}: {
  legacyState: 'unknown' | 'zero' | 'positive';
  ownerToken?: IHomeRuntimeOwnerToken;
  semanticPresentationEnabled?: boolean;
  shadowFactsPresent: boolean;
  shell?: IHomeShellSemanticModel;
}): IHomeBalancePresentation {
  if (!semanticPresentationEnabled) {
    return { balanceState: legacyState };
  }
  if (shell) {
    const legacyPresentation = adaptHomeShellToLegacy(shell);
    const revision = stringUtils.stableStringify({ ownerToken, shell });
    if ('balance' in legacyPresentation && legacyPresentation.balance) {
      return {
        balanceState: legacyPresentation.balanceState,
        correlated: {
          kind: 'ready',
          balance: legacyPresentation.balance,
          balanceState: legacyPresentation.balanceState,
          revision,
          showPositiveBanner: legacyPresentation.showPositiveBanner,
        },
      };
    }
    const loadingBalanceState =
      legacyPresentation.balanceState === 'positive' ? 'positive' : 'unknown';
    return {
      balanceState: loadingBalanceState,
      correlated: {
        kind: 'loading',
        balanceState: loadingBalanceState,
        revision,
        showPositiveBanner: legacyPresentation.showPositiveBanner,
      },
    };
  }
  const balanceState = resolveHomeLegacyBalanceState({
    legacyState,
    shadowFactsPresent,
    shell,
  });
  if (shadowFactsPresent) {
    return {
      balanceState,
      correlated: {
        kind: 'loading',
        balanceState: 'unknown',
        revision: stringUtils.stableStringify({
          kind: 'awaitingSemanticShell',
          ownerToken,
        }),
        showPositiveBanner: false,
      },
    };
  }
  return { balanceState };
}

function resolveHomeOverviewBalanceRenderDecision({
  balancePresentation,
  legacyAmount,
  legacyShowSkeleton,
  semanticDisplayAmount,
}: {
  balancePresentation?: IHomeCorrelatedBalancePresentation;
  legacyAmount?: string;
  legacyShowSkeleton: boolean;
  semanticDisplayAmount?: string;
}): IHomeOverviewBalanceRenderDecision {
  if (!balancePresentation) {
    return { amount: legacyAmount, showSkeleton: legacyShowSkeleton };
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
  adaptHomeShellToLegacy,
  resolveHomeBalancePresentation,
  resolveHomeLegacyBalanceState,
  resolveHomeOverviewBalanceRenderDecision,
};
export type {
  IHomeBalancePresentation,
  IHomeCorrelatedBalancePresentation,
  IHomeLegacyShellPresentation,
  IHomeOverviewBalanceRenderDecision,
};
