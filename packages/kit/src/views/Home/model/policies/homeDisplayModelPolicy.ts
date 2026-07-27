import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import type {
  IHomeActionId,
  IHomeMoneyViewModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';

export type IHomeFundingVerdict = 'funded' | 'unknown' | 'zero';

export type IHomeBalanceDisplayAuthority =
  | 'confirmedCache'
  | 'live'
  | 'partial';

export type IHomeBalanceDisplayPresentation =
  | {
      kind: 'loading';
      revision: string;
    }
  | {
      kind: 'ready';
      authority: IHomeBalanceDisplayAuthority;
      balance: IHomeMoneyViewModel;
      revision: string;
    };

export type IHomeActionsPresentation =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | {
      kind: 'funded' | 'zero';
      items: readonly IHomeActionId[];
    };

export type IHomeBannerPresentation =
  | { kind: 'eligible' }
  | { kind: 'hidden' }
  | { kind: 'pending' };

export type IHomeBodyPresentation =
  | { kind: 'backupPrompt' }
  | { kind: 'loading' }
  | { kind: 'missingNetworkAccount' }
  | { kind: 'portfolio' };

export type IHomeNavigationPresentation =
  | { kind: 'default' }
  | { kind: 'hidden' }
  | { kind: 'portfolioOnly' };

export type IHomeDisplayModel = {
  actions: IHomeActionsPresentation;
  balance: IHomeBalanceDisplayPresentation;
  banner: IHomeBannerPresentation;
  body: IHomeBodyPresentation;
  fundingVerdict: IHomeFundingVerdict;
  navigation: IHomeNavigationPresentation;
};

function resolveFundingVerdict(
  shell: IHomeShellSemanticModel,
): IHomeFundingVerdict {
  if (shell.kind !== 'portfolio') {
    return 'unknown';
  }
  if (shell.presentation.kind === 'zero') {
    return 'zero';
  }
  if (
    shell.presentation.kind === 'funded' ||
    shell.presentation.kind === 'fundedPendingTotal'
  ) {
    return 'funded';
  }
  return 'unknown';
}

function resolveHomeBalanceDisplay({
  ownerToken,
  shell,
}: {
  ownerToken?: IHomeRuntimeOwnerToken;
  shell: IHomeShellSemanticModel;
}): IHomeBalanceDisplayPresentation {
  const portfolio = shell.kind === 'portfolio' ? shell.presentation : undefined;
  let authority: IHomeBalanceDisplayAuthority | undefined;
  let balance: IHomeMoneyViewModel | undefined;

  if (portfolio?.kind === 'zero') {
    authority =
      portfolio.freshness === 'confirmedCache' ? 'confirmedCache' : 'live';
    balance = portfolio.header.balance;
  } else if (portfolio?.kind === 'funded') {
    authority = portfolio.header.authority;
    balance = portfolio.header.balance;
  } else if (
    portfolio?.kind === 'fundedPendingTotal' &&
    portfolio.header.balance
  ) {
    authority = 'partial';
    balance = portfolio.header.balance;
  }

  const revision = [
    ownerToken?.scopeKey ?? '',
    ownerToken?.sessionId ?? '',
    authority ?? '',
    balance?.amount ?? '',
    balance?.currency ?? '',
  ].join('|');
  return balance && authority
    ? {
        authority,
        balance,
        kind: 'ready',
        revision,
      }
    : { kind: 'loading', revision };
}

function resolveHomeActions(
  shell: IHomeShellSemanticModel,
): IHomeActionsPresentation {
  if (
    shell.kind === 'backupRequired' ||
    shell.kind === 'missingNetworkAccount'
  ) {
    return { kind: 'hidden' };
  }
  if (shell.kind !== 'portfolio') {
    return { kind: 'loading' };
  }
  const { actions } = shell.presentation;
  if (actions.kind === 'funded' || actions.kind === 'zero') {
    return actions;
  }
  return { kind: 'loading' };
}

function resolveHomeBanner(
  shell: IHomeShellSemanticModel,
): IHomeBannerPresentation {
  if (
    shell.kind === 'backupRequired' ||
    shell.kind === 'missingNetworkAccount'
  ) {
    return { kind: 'hidden' };
  }
  if (shell.kind !== 'portfolio') {
    return { kind: 'pending' };
  }
  if (shell.presentation.banner.kind === 'positive') {
    return { kind: 'eligible' };
  }
  if (
    shell.presentation.kind === 'loading' ||
    shell.presentation.kind === 'fundedPendingTotal'
  ) {
    return { kind: 'pending' };
  }
  return { kind: 'hidden' };
}

function resolveHomeBody(
  shell: IHomeShellSemanticModel,
): IHomeBodyPresentation {
  switch (shell.kind) {
    case 'backupRequired':
      return { kind: 'backupPrompt' };
    case 'missingNetworkAccount':
      return { kind: 'missingNetworkAccount' };
    case 'portfolio':
      return { kind: 'portfolio' };
    case 'loading':
      return { kind: 'loading' };
    default:
      return assertNever(shell);
  }
}

function resolveHomeNavigation(
  body: IHomeBodyPresentation,
): IHomeNavigationPresentation {
  switch (body.kind) {
    case 'backupPrompt':
      return { kind: 'portfolioOnly' };
    case 'loading':
    case 'missingNetworkAccount':
      return { kind: 'hidden' };
    case 'portfolio':
      return { kind: 'default' };
    default:
      return assertNever(body);
  }
}

export function projectHomeDisplayModel({
  ownerToken,
  shell,
}: {
  ownerToken?: IHomeRuntimeOwnerToken;
  shell: IHomeShellSemanticModel;
}): IHomeDisplayModel {
  const body = resolveHomeBody(shell);
  return {
    actions: resolveHomeActions(shell),
    balance: resolveHomeBalanceDisplay({
      ownerToken,
      shell,
    }),
    banner: resolveHomeBanner(shell),
    body,
    fundingVerdict: resolveFundingVerdict(shell),
    navigation: resolveHomeNavigation(body),
  };
}

function assertNever(value: never): never {
  throw new OneKeyLocalError(`Unexpected Home display value: ${String(value)}`);
}
