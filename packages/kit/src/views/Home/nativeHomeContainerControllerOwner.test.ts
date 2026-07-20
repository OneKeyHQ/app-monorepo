import { act, renderHook } from '@testing-library/react-native';

import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerRef,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import { resolveNativeHomeHeaderActionPresentation } from './nativeHomeBalanceAuthority';
import {
  type INativeHomeContainerControllerOwner,
  acquireNativeHomeContainerController,
} from './nativeHomeContainerControllerOwner';
import { useNativeHomeContainerScopeController } from './useNativeHomeContainerScopeController';

const capabilities: IHomeContainerCapabilities = {
  schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
  tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
  supportsPatches: true,
  supportsAtomicPatches: true,
  supportsHorizontalPaging: true,
  supportsNativeRefresh: true,
};

function buildSnapshot({
  accountName = 'Account 1',
  actionLayout = 'standard',
  actionRowHeight = 62,
  actions = [],
  balance = '$1',
  banners = [],
  networkName,
  tokenSymbol,
}: {
  accountName?: string;
  actionLayout?: IHomeContainerSnapshot['header']['actionLayout'];
  actionRowHeight?: number;
  actions?: IHomeContainerSnapshot['header']['actions'];
  balance?: string;
  banners?: IHomeContainerSnapshot['header']['banners'];
  networkName: string;
  tokenSymbol?: string;
}): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 0,
    selectedTabId: 'portfolio',
    header: {
      accountName,
      accountSubtitle: networkName,
      actionLayout,
      actionRowHeight,
      actions,
      balance,
      banners,
      networkName,
    },
    tabs: [
      {
        id: 'portfolio',
        title: 'Spot',
        destination: 'inline',
        sections: [
          {
            id: `assets-${networkName}`,
            items: tokenSymbol
              ? [
                  {
                    id: tokenSymbol,
                    renderer: 'asset',
                    title: tokenSymbol,
                  },
                ]
              : [],
          },
        ],
      },
    ],
    theme: {
      accentColor: '#000000',
      backgroundColor: '#FFFFFF',
      cardColor: '#F5F5F5',
      dividerColor: '#E5E5E5',
      negativeColor: '#D92D20',
      positiveColor: '#087A55',
      primaryTextColor: '#111111',
      secondaryTextColor: '#666666',
    },
  };
}

function buildRevisionRejectingTarget() {
  let appliedSnapshot: IHomeContainerSnapshot | undefined;
  const writes: Array<
    { kind: 'full'; revision: number } | { kind: 'patch'; revision: number }
  > = [];
  const target: jest.Mocked<IHomeContainerRef> = {
    applyPatch: jest.fn((patch) => {
      writes.push({ kind: 'patch', revision: patch.revision });
      if (!appliedSnapshot || patch.revision < appliedSnapshot.revision) {
        return;
      }
      const sectionsByTab = new Map(
        patch.tabs.map(({ sections, tabId }) => [tabId, sections]),
      );
      appliedSnapshot = {
        ...appliedSnapshot,
        header: patch.header ?? appliedSnapshot.header,
        revision: patch.revision,
        tabs: appliedSnapshot.tabs.map((tab) => ({
          ...tab,
          sections: sectionsByTab.get(tab.id) ?? tab.sections,
        })),
      };
    }),
    completeRefresh: jest.fn(),
    getCapabilities: jest.fn(() => capabilities),
    selectTab: jest.fn(),
    setSnapshot: jest.fn((snapshot) => {
      writes.push({ kind: 'full', revision: snapshot.revision });
      if (!appliedSnapshot || snapshot.revision >= appliedSnapshot.revision) {
        appliedSnapshot = snapshot;
      }
    }),
  };
  return {
    clearWrites: () => {
      writes.length = 0;
    },
    getAppliedSnapshot: () => appliedSnapshot,
    getWrites: () => writes,
    target,
  };
}

describe('Native Home container controller owner', () => {
  it('keeps a mounted production scope hook atomic across account rerenders', async () => {
    const owner: INativeHomeContainerControllerOwner = {};
    const nativeTarget = buildRevisionRejectingTarget();
    const onSelectedTabIdChange = jest.fn();
    const positivePresentation =
      resolveNativeHomeHeaderActionPresentation('positive');
    const loadingPresentation =
      resolveNativeHomeHeaderActionPresentation('unknown');
    const zeroPresentation = resolveNativeHomeHeaderActionPresentation('zero');
    const account3Snapshot = buildSnapshot({
      accountName: 'Account #3',
      actionLayout: positivePresentation.actionLayout,
      actionRowHeight: positivePresentation.rowHeight,
      actions: [
        {
          actionId: 'home.header.send',
          icon: 'send',
          id: 'send',
          title: 'Send',
        },
      ],
      balance: '$12',
      banners: [
        {
          actionId: 'home.banner.open',
          id: 'account-3-banner',
          title: 'Account #3 banner',
        },
      ],
      networkName: 'Polygon',
      tokenSymbol: 'POL',
    });
    const account5LoadingSnapshot = buildSnapshot({
      accountName: 'Account #5',
      actionLayout: loadingPresentation.actionLayout,
      actionRowHeight: loadingPresentation.rowHeight,
      balance: '',
      networkName: 'Polygon',
    });
    const account5ZeroSnapshot: IHomeContainerSnapshot = {
      ...account5LoadingSnapshot,
      header: {
        ...account5LoadingSnapshot.header,
        actionLayout: zeroPresentation.actionLayout,
        actionRowHeight: zeroPresentation.rowHeight,
        actions: [
          {
            actionId: 'home.header.receive',
            icon: 'receive',
            id: 'add-money',
            title: 'Add money',
          },
        ],
        balance: '$0',
      },
    };
    const account3StructuralTabState = {
      scopeKey: 'wallet::polygon::account-3',
      selectedTabId: account3Snapshot.selectedTabId,
      tabs: account3Snapshot.tabs,
    };
    const account5StructuralTabState = {
      scopeKey: 'wallet::polygon::account-5',
      selectedTabId: account5LoadingSnapshot.selectedTabId,
      tabs: account5LoadingSnapshot.tabs,
    };
    const account3Props = {
      scopeSnapshot: account3Snapshot,
      sectionsByTab: {
        portfolio: account3Snapshot.tabs[0].sections,
      },
      structuralTabState: account3StructuralTabState,
    };
    const account5Props = {
      scopeSnapshot: account5LoadingSnapshot,
      sectionsByTab: {
        portfolio: account5LoadingSnapshot.tabs[0].sections,
      },
      structuralTabState: account5StructuralTabState,
    };
    const { result, rerender } = renderHook(
      (props: typeof account3Props) =>
        useNativeHomeContainerScopeController({
          ...props,
          owner,
          shouldCommitTabs: true,
          onSelectedTabIdChange,
        }),
      { initialProps: account3Props },
    );

    act(() => {
      expect(result.current.attach(nativeTarget.target, capabilities)).toBe(
        true,
      );
    });
    const controller = result.current;
    const account3Revision = nativeTarget.getAppliedSnapshot()?.revision ?? 0;
    nativeTarget.clearWrites();
    nativeTarget.target.setSnapshot.mockClear();
    nativeTarget.target.applyPatch.mockClear();

    await act(async () => {
      rerender(account5Props);
      await Promise.resolve();
    });

    expect(result.current).toBe(controller);
    expect(nativeTarget.getWrites()[0]).toEqual({
      kind: 'full',
      revision: account3Revision + 1,
    });
    expect(nativeTarget.target.setSnapshot).toHaveBeenCalledTimes(1);
    expect(nativeTarget.target.applyPatch).not.toHaveBeenCalled();
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: {
        accountName: 'Account #5',
        actionLayout: 'loading',
        actionRowHeight: 82,
        actions: [],
        balance: '',
        banners: [],
      },
      tabs: [
        {
          sections: [{ items: [] }],
        },
      ],
    });
    expect(nativeTarget.getAppliedSnapshot()?.revision).toBeGreaterThan(
      account3Revision,
    );

    nativeTarget.clearWrites();
    nativeTarget.target.setSnapshot.mockClear();
    nativeTarget.target.applyPatch.mockClear();
    await act(async () => {
      rerender(account5Props);
      await Promise.resolve();
    });
    expect(result.current).toBe(controller);
    expect(nativeTarget.target.setSnapshot).not.toHaveBeenCalled();
    expect(nativeTarget.getWrites()).toEqual([]);

    const settledAccount5Props = {
      ...account5Props,
      scopeSnapshot: account5ZeroSnapshot,
    };
    await act(async () => {
      rerender(settledAccount5Props);
      await Promise.resolve();
    });

    expect(result.current).toBe(controller);
    expect(nativeTarget.target.setSnapshot).not.toHaveBeenCalled();
    expect(nativeTarget.target.applyPatch).toHaveBeenCalledTimes(1);
    expect(nativeTarget.getWrites()).toEqual([
      { kind: 'patch', revision: account3Revision + 2 },
    ]);
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: {
        accountName: 'Account #5',
        actionLayout: 'zeroBalance',
        actionRowHeight: 82,
        actions: [{ id: 'add-money' }],
        balance: '$0',
        banners: [],
      },
      tabs: [
        {
          sections: [{ items: [] }],
        },
      ],
    });
  });

  it('atomically replaces a mounted target when the account scope changes', () => {
    const owner: INativeHomeContainerControllerOwner = {};
    const nativeTarget = buildRevisionRejectingTarget();
    const account3Controller = acquireNativeHomeContainerController({
      owner,
      scopeKey: 'wallet::polygon::account-3',
      snapshot: buildSnapshot({
        accountName: 'Account #3',
        actionRowHeight: 62,
        balance: '$12',
        banners: [
          {
            actionId: 'home.banner.open',
            id: 'account-3-banner',
            title: 'Account #3 banner',
          },
        ],
        networkName: 'Polygon',
        tokenSymbol: 'POL',
      }),
    });
    expect(account3Controller.attach(nativeTarget.target, capabilities)).toBe(
      true,
    );
    const account3Revision = nativeTarget.getAppliedSnapshot()?.revision ?? 0;

    const account5Controller = acquireNativeHomeContainerController({
      owner,
      scopeKey: 'wallet::polygon::account-5',
      snapshot: buildSnapshot({
        accountName: 'Account #5',
        actionRowHeight: 82,
        balance: '$0',
        networkName: 'Polygon',
      }),
    });

    expect(account5Controller).toBe(account3Controller);
    expect(nativeTarget.target.applyPatch).not.toHaveBeenCalled();
    expect(account5Controller.flushNow()).toBe(true);
    expect(nativeTarget.target.setSnapshot).toHaveBeenCalledTimes(2);
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: {
        accountName: 'Account #5',
        actionRowHeight: 82,
        balance: '$0',
        banners: [],
      },
      tabs: [
        {
          sections: [
            {
              items: [],
            },
          ],
        },
      ],
    });
    expect(nativeTarget.getAppliedSnapshot()?.revision).toBeGreaterThan(
      account3Revision,
    );

    nativeTarget.target.setSnapshot.mockClear();
    nativeTarget.target.applyPatch.mockClear();
    expect(
      acquireNativeHomeContainerController({
        owner,
        scopeKey: 'wallet::polygon::account-5',
        snapshot: buildSnapshot({
          accountName: 'ignored same-scope snapshot',
          networkName: 'Polygon',
          tokenSymbol: 'OLD',
        }),
      }),
    ).toBe(account5Controller);
    expect(account5Controller.flushNow()).toBe(false);

    account5Controller.updateHeader({
      ...account5Controller.getSnapshot().header,
      balance: '$0.01',
    });
    account5Controller.updateTabSections('portfolio', [
      { id: 'assets-Polygon-current', items: [] },
    ]);
    expect(account5Controller.flushNow()).toBe(true);
    expect(nativeTarget.target.setSnapshot).not.toHaveBeenCalled();
    expect(nativeTarget.target.applyPatch).toHaveBeenCalledTimes(1);
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: {
        accountName: 'Account #5',
        actionRowHeight: 82,
        balance: '$0.01',
        banners: [],
      },
      tabs: [
        {
          sections: [{ id: 'assets-Polygon-current', items: [] }],
        },
      ],
    });
  });

  it('keeps revision ownership across Polygon -> missing TON -> Tron -> All remounts', () => {
    const owner: INativeHomeContainerControllerOwner = {};
    const nativeTarget = buildRevisionRejectingTarget();
    const polygonController = acquireNativeHomeContainerController({
      owner,
      scopeKey: 'wallet::polygon::account-polygon',
      snapshot: buildSnapshot({
        networkName: 'Polygon',
        tokenSymbol: 'POL',
      }),
    });
    expect(polygonController.attach(nativeTarget.target, capabilities)).toBe(
      true,
    );
    for (let index = 0; index < 8; index += 1) {
      polygonController.updateHeader({
        ...polygonController.getSnapshot().header,
        balance: `$${index + 2}`,
      });
      polygonController.flushNow();
    }
    const polygonRevision = nativeTarget.getAppliedSnapshot()?.revision ?? 0;
    polygonController.detach(nativeTarget.target);

    const tronController = acquireNativeHomeContainerController({
      owner,
      scopeKey: 'wallet::tron::account-tron',
      snapshot: buildSnapshot({
        networkName: 'Tron',
        tokenSymbol: 'TRX',
      }),
    });
    expect(tronController).toBe(polygonController);
    expect(tronController.attach(nativeTarget.target, capabilities)).toBe(true);
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: { networkName: 'Tron' },
      tabs: [
        {
          sections: [
            {
              items: [{ id: 'TRX', title: 'TRX' }],
            },
          ],
        },
      ],
    });
    expect(nativeTarget.getAppliedSnapshot()?.revision).toBeGreaterThan(
      polygonRevision,
    );
    tronController.detach(nativeTarget.target);

    const allController = acquireNativeHomeContainerController({
      owner,
      scopeKey: 'wallet::all::account-all',
      snapshot: buildSnapshot({
        networkName: 'All Networks',
        tokenSymbol: 'ALL',
      }),
    });
    expect(allController).toBe(polygonController);
    expect(allController.attach(nativeTarget.target, capabilities)).toBe(true);
    expect(nativeTarget.getAppliedSnapshot()).toMatchObject({
      header: { networkName: 'All Networks' },
      tabs: [
        {
          sections: [
            {
              items: [{ id: 'ALL', title: 'ALL' }],
            },
          ],
        },
      ],
    });
  });
});
