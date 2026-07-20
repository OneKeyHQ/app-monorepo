import {
  HOME_CONTAINER_PROTOCOL_VERSION,
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerChange,
  type IHomeContainerNavigationTab,
  type IHomeContainerOwner,
  type IHomeContainerPatchEnvelope,
  type IHomeContainerSection,
  type IHomeContainerSnapshot,
  type IHomeContainerSnapshotEnvelope,
  type IHomeContainerSnapshotPayload,
  type IHomeContainerTabId,
} from '@onekeyhq/native-components';

import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

type IHomeNativeShellPresentation =
  | {
      actionFamily: 'loading';
      balanceStatus: 'loading';
      showPositiveBanner: false;
    }
  | {
      actionFamily: 'zero';
      amount: string;
      balanceStatus: 'ready';
      currency: string;
      showPositiveBanner: false;
    }
  | {
      actionFamily: 'funded';
      amount?: string;
      balanceStatus: 'loading' | 'ready';
      currency?: string;
      showPositiveBanner: boolean;
    };

function adaptHomeShellToNativeHeader(
  shell: IHomeShellSemanticModel,
): IHomeNativeShellPresentation {
  if (shell.kind !== 'portfolio') {
    return {
      actionFamily: 'loading',
      balanceStatus: 'loading',
      showPositiveBanner: false,
    };
  }
  const { presentation } = shell;
  if (presentation.kind === 'zero') {
    return {
      actionFamily: 'zero',
      amount: presentation.header.balance.amount,
      balanceStatus: 'ready',
      currency: presentation.header.balance.currency,
      showPositiveBanner: false,
    };
  }
  if (presentation.kind === 'funded') {
    return {
      actionFamily: 'funded',
      amount: presentation.header.balance.amount,
      balanceStatus: 'ready',
      currency: presentation.header.balance.currency,
      showPositiveBanner: presentation.banner.kind === 'positive',
    };
  }
  if (presentation.kind === 'fundedPendingTotal') {
    return {
      actionFamily: 'funded',
      balanceStatus: 'loading',
      showPositiveBanner: presentation.banner.kind === 'positive',
    };
  }
  return {
    actionFamily: 'loading',
    balanceStatus: 'loading',
    showPositiveBanner: false,
  };
}

function toNavigationTab(
  tab: IHomeContainerSnapshot['tabs'][number],
): IHomeContainerNavigationTab {
  const { sections: _sections, ...shell } = tab;
  return shell;
}

function toPayload(
  snapshot: IHomeContainerSnapshot,
): IHomeContainerSnapshotPayload {
  return {
    selectedTabId: snapshot.selectedTabId,
    header: snapshot.header,
    tabs: snapshot.tabs,
    theme: snapshot.theme,
  };
}

function createHomeNativeSnapshotEnvelope({
  owner,
  revision,
  snapshot,
}: {
  owner: IHomeContainerOwner;
  revision: number;
  snapshot: IHomeContainerSnapshot;
}): IHomeContainerSnapshotEnvelope {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_VERSION,
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    owner,
    revision,
    payload: toPayload(snapshot),
  };
}

function createHomeNativePatchEnvelope({
  baseRevision,
  changes,
  owner,
  revision,
}: {
  baseRevision: number;
  changes: IHomeContainerChange[];
  owner: IHomeContainerOwner;
  revision: number;
}): IHomeContainerPatchEnvelope {
  return {
    kind: 'patch',
    protocolVersion: HOME_CONTAINER_PROTOCOL_VERSION,
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    owner,
    baseRevision,
    revision,
    changes,
  };
}

function createReplaceNavigationChange(
  snapshot: IHomeContainerSnapshot,
): IHomeContainerChange {
  return {
    kind: 'replaceNavigation',
    value: {
      selectedTabId: snapshot.selectedTabId,
      tabs: snapshot.tabs.map(toNavigationTab),
    },
  };
}

function createReplaceSectionChange({
  index,
  section,
  tabId,
}: {
  index: number;
  section: IHomeContainerSection;
  tabId: IHomeContainerTabId;
}): IHomeContainerChange {
  return {
    kind: 'replaceSection',
    tabId,
    sectionId: section.id,
    index,
    value: section,
  };
}

export {
  adaptHomeShellToNativeHeader,
  createHomeNativePatchEnvelope,
  createHomeNativeSnapshotEnvelope,
  createReplaceNavigationChange,
  createReplaceSectionChange,
  toNavigationTab,
};
export type { IHomeNativeShellPresentation };
