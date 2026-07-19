import { useEffect, useLayoutEffect, useRef } from 'react';

import {
  type HomeContainerController,
  type IHomeContainerSection,
  type IHomeContainerSnapshot,
  type IHomeContainerTabId,
} from '@onekeyhq/native-components';

import {
  type INativeHomeContainerControllerOwner,
  acquireNativeHomeContainerController,
} from './nativeHomeContainerControllerOwner';

interface IUseNativeHomeContainerScopeControllerOptions {
  owner: INativeHomeContainerControllerOwner;
  scopeSnapshot: IHomeContainerSnapshot;
  structuralTabState: Pick<IHomeContainerSnapshot, 'selectedTabId' | 'tabs'> & {
    scopeKey: string;
  };
  shouldCommitTabs: boolean;
  sectionsByTab: Partial<Record<IHomeContainerTabId, IHomeContainerSection[]>>;
  onSelectedTabIdChange: (tabId: IHomeContainerTabId) => void;
}

function useNativeHomeContainerScopeController({
  owner,
  scopeSnapshot,
  structuralTabState,
  shouldCommitTabs,
  sectionsByTab,
  onSelectedTabIdChange,
}: IUseNativeHomeContainerScopeControllerOptions): HomeContainerController {
  const { scopeKey } = structuralTabState;
  const scopeSnapshotCommitRef = useRef<string | undefined>(undefined);
  const changesControllerScope = owner.scopeKey !== scopeKey;
  const controller = acquireNativeHomeContainerController({
    owner,
    scopeKey,
    snapshot: scopeSnapshot,
  });
  if (changesControllerScope) {
    scopeSnapshotCommitRef.current = scopeKey;
  }

  useEffect(() => {
    controller.updateTheme(scopeSnapshot.theme);
  }, [controller, scopeSnapshot.theme]);
  useEffect(() => {
    controller.updateHeader(scopeSnapshot.header);
  }, [controller, scopeSnapshot.header]);
  useLayoutEffect(() => {
    if (scopeSnapshotCommitRef.current === scopeKey) {
      scopeSnapshotCommitRef.current = undefined;
    } else {
      controller.replaceSnapshot({
        ...controller.getSnapshot(),
        selectedTabId: structuralTabState.selectedTabId,
        tabs: structuralTabState.tabs,
      });
    }
    onSelectedTabIdChange(structuralTabState.selectedTabId);
  }, [controller, onSelectedTabIdChange, scopeKey, structuralTabState]);

  const portfolioSections = sectionsByTab.portfolio;
  const perpsSections = sectionsByTab.perps;
  const deFiSections = sectionsByTab.defi;
  const nftSections = sectionsByTab.nft;
  const historySections = sectionsByTab.history;
  useEffect(() => {
    if (shouldCommitTabs && portfolioSections) {
      controller.updateTabSections('portfolio', portfolioSections);
    }
  }, [controller, portfolioSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && perpsSections) {
      controller.updateTabSections('perps', perpsSections);
    }
  }, [controller, perpsSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && deFiSections) {
      controller.updateTabSections('defi', deFiSections);
    }
  }, [controller, deFiSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && nftSections) {
      controller.updateTabSections('nft', nftSections);
    }
  }, [controller, nftSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && historySections) {
      controller.updateTabSections('history', historySections);
    }
  }, [controller, historySections, shouldCommitTabs]);

  return controller;
}

export { useNativeHomeContainerScopeController };
export type { IUseNativeHomeContainerScopeControllerOptions };
