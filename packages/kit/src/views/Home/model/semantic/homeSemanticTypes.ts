import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomePerpsDestination } from '../capabilities/homeCapabilityTypes';

export type IHomeTabId = 'portfolio' | 'perps' | 'defi' | 'nft' | 'history';

export type IHomeSectionId =
  | 'portfolio'
  | 'perps'
  | 'defi'
  | 'nft'
  | 'history'
  | 'market';

export type IHomeActionId =
  | 'send'
  | 'receive'
  | 'buySell'
  | 'swap'
  | 'addMoney'
  | 'more';

export type IHomeMoneyViewModel = {
  amount: string;
  currency: string;
};

export type IHomePortfolioPresentation =
  | {
      kind: 'loading';
      header: { kind: 'loading' };
      actions: { kind: 'loading'; items: readonly [] };
      banner: { kind: 'none' };
      refresh?: 'refreshing' | 'failed';
    }
  | {
      kind: 'fundedPendingTotal';
      header: { kind: 'loading'; balance?: IHomeMoneyViewModel };
      actions: { kind: 'funded'; items: readonly IHomeActionId[] };
      banner: { kind: 'positive' } | { kind: 'none' };
      refresh?: 'refreshing' | 'failed';
    }
  | {
      kind: 'zero';
      header: { kind: 'zero'; balance: IHomeMoneyViewModel };
      actions: { kind: 'zero'; items: readonly IHomeActionId[] };
      banner: { kind: 'none' };
      freshness?: 'live' | 'confirmedCache';
      refresh?: 'idle' | 'refreshing' | 'failed';
    }
  | {
      kind: 'funded';
      header: {
        kind: 'funded';
        balance: IHomeMoneyViewModel;
        authority: 'live' | 'confirmedCache';
      };
      actions: { kind: 'funded'; items: readonly IHomeActionId[] };
      banner: { kind: 'positive' } | { kind: 'none' };
      freshness?: 'live' | 'confirmedCache';
      refresh?: 'idle' | 'refreshing' | 'failed';
    }
  | {
      kind: 'unavailable';
      header: {
        kind: 'unavailable';
        reason: 'sourceError' | 'runtimeUnavailable' | 'invalidAmount';
      };
      actions: { kind: 'loading'; items: readonly [] };
      banner: { kind: 'none' };
    };

export type IHomeShellSemanticModel =
  | { kind: 'loading' }
  | { kind: 'backupRequired'; commandId: 'backupWallet' }
  | { kind: 'missingNetworkAccount' }
  | { kind: 'portfolio'; presentation: IHomePortfolioPresentation };

export type IHomeNavigationSemanticModel =
  | { kind: 'hidden' }
  | {
      kind: 'ready';
      tabs: readonly [IHomeTabId, ...IHomeTabId[]];
      selectedTabId: IHomeTabId;
      destinations?: never;
      freshness?: never;
      perpsDestination?: never;
      refresh?: never;
      sections?: never;
    }
  | {
      kind: 'ready';
      destinations: Readonly<Partial<Record<IHomeTabId, 'inline' | 'web'>>>;
      freshness: 'live' | 'confirmedCache';
      perpsDestination: IHomePerpsDestination;
      refresh: 'idle' | 'refreshing' | 'failed';
      sections: Readonly<Record<IHomeSectionId, boolean>>;
      tabs: readonly [IHomeTabId, ...IHomeTabId[]];
      selectedTabId: IHomeTabId;
    };

export type IHomeSectionSemanticModel =
  | { kind: 'hidden'; reason: 'notApplicable' | 'capabilityNotReady' }
  | { kind: 'loading'; placeholder: IHomeSectionId }
  | { kind: 'empty'; emptyState: IHomeSectionId }
  | {
      kind: 'ready';
      rowIds: readonly string[];
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    }
  | { kind: 'error'; errorState: IHomeSectionId };

export type IHomeSemanticModel = {
  owner: IHomeRuntimeOwnerToken;
  shell: IHomeShellSemanticModel;
  navigation: IHomeNavigationSemanticModel;
  sections: Readonly<Record<IHomeSectionId, IHomeSectionSemanticModel>>;
};
