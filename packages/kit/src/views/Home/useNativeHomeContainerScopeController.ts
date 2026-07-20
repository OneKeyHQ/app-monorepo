import { useEffect, useMemo } from 'react';

import {
  type HomeContainerController,
  type IHomeContainerSection,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerTabId,
} from '@onekeyhq/native-components';

import {
  type INativeHomeContainerControllerOwner,
  acquireNativeHomeContainerController,
  commitNativeHomeContainerControllerScope,
} from './nativeHomeContainerControllerOwner';

interface IUseNativeHomeContainerScopeControllerOptions {
  owner: INativeHomeContainerControllerOwner;
  scopeSnapshot: IHomeContainerSnapshot;
  structuralTabState: Pick<IHomeContainerSnapshot, 'selectedTabId' | 'tabs'> & {
    scopeKey: string;
  };
  shouldCommitTabs: boolean;
  sectionsByTab: Partial<Record<IHomeContainerTabId, IHomeContainerSection[]>>;
  slots?: IHomeContainerSlots;
  onSelectedTabIdChange: (tabId: IHomeContainerTabId) => void;
}

function useNativeHomeContainerScopeController({
  owner,
  scopeSnapshot,
  structuralTabState,
  shouldCommitTabs,
  sectionsByTab,
  slots,
  onSelectedTabIdChange,
}: IUseNativeHomeContainerScopeControllerOptions): HomeContainerController {
  const { scopeKey } = structuralTabState;
  const controller = acquireNativeHomeContainerController({
    owner,
    scopeKey,
    snapshot: scopeSnapshot,
    deferScopeCommit: true,
  });

  useEffect(() => {
    commitNativeHomeContainerControllerScope({
      owner,
      scopeKey,
      snapshot: scopeSnapshot,
    });
  }, [owner, scopeKey, scopeSnapshot]);
  useEffect(() => {
    const currentSnapshot = controller.getSnapshot();
    if (
      currentSnapshot.selectedTabId !== structuralTabState.selectedTabId ||
      currentSnapshot.tabs !== structuralTabState.tabs
    ) {
      controller.replaceSnapshot({
        ...currentSnapshot,
        selectedTabId: structuralTabState.selectedTabId,
        tabs: structuralTabState.tabs,
      });
    }
    onSelectedTabIdChange(structuralTabState.selectedTabId);
  }, [controller, onSelectedTabIdChange, structuralTabState]);
  useEffect(() => {
    controller.updateTheme(scopeSnapshot.theme);
  }, [controller, scopeSnapshot.theme]);
  useEffect(() => {
    controller.updateHeader(scopeSnapshot.header);
  }, [controller, scopeSnapshot.header]);

  const portfolioSections = sectionsByTab.portfolio;
  const perpsSections = sectionsByTab.perps;
  const deFiSections = sectionsByTab.defi;
  const nftSections = sectionsByTab.nft;
  const historySections = sectionsByTab.history;
  const inlineTabIds = useMemo(
    () =>
      new Set(
        structuralTabState.tabs
          .filter((tab) => tab.destination === 'inline')
          .map((tab) => tab.id),
      ),
    [structuralTabState.tabs],
  );
  useEffect(() => {
    if (
      shouldCommitTabs &&
      inlineTabIds.has('portfolio') &&
      portfolioSections
    ) {
      controller.updateTabSections('portfolio', portfolioSections);
    }
  }, [controller, inlineTabIds, portfolioSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && inlineTabIds.has('perps') && perpsSections) {
      controller.updateTabSections('perps', perpsSections);
    }
  }, [controller, inlineTabIds, perpsSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && inlineTabIds.has('defi') && deFiSections) {
      controller.updateTabSections('defi', deFiSections);
    }
  }, [controller, deFiSections, inlineTabIds, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && inlineTabIds.has('nft') && nftSections) {
      controller.updateTabSections('nft', nftSections);
    }
  }, [controller, inlineTabIds, nftSections, shouldCommitTabs]);
  useEffect(() => {
    if (shouldCommitTabs && inlineTabIds.has('history') && historySections) {
      controller.updateTabSections('history', historySections);
    }
  }, [controller, historySections, inlineTabIds, shouldCommitTabs]);
  useEffect(() => {
    if (slots) {
      controller.updateSlots(slots);
    }
  }, [controller, slots]);

  return controller;
}

export { useNativeHomeContainerScopeController };
export type { IUseNativeHomeContainerScopeControllerOptions };
