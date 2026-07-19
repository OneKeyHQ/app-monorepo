import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerRef,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import {
  type INativeHomeContainerControllerOwner,
  acquireNativeHomeContainerController,
} from './nativeHomeContainerControllerOwner';

const capabilities: IHomeContainerCapabilities = {
  schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
  tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
  supportsPatches: true,
  supportsAtomicPatches: true,
  supportsHorizontalPaging: true,
  supportsNativeRefresh: true,
};

function buildSnapshot({
  networkName,
  tokenSymbol,
}: {
  networkName: string;
  tokenSymbol: string;
}): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 0,
    selectedTabId: 'portfolio',
    header: {
      accountName: 'Account 1',
      accountSubtitle: networkName,
      actions: [],
      balance: '$1',
      banners: [],
      networkName,
    },
    tabs: [
      {
        id: 'portfolio',
        title: 'Spot',
        sections: [
          {
            id: `assets-${networkName}`,
            items: [
              {
                id: tokenSymbol,
                renderer: 'asset',
                title: tokenSymbol,
              },
            ],
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
  const target: jest.Mocked<IHomeContainerRef> = {
    applyPatch: jest.fn((patch) => {
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
      if (!appliedSnapshot || snapshot.revision >= appliedSnapshot.revision) {
        appliedSnapshot = snapshot;
      }
    }),
  };
  return {
    getAppliedSnapshot: () => appliedSnapshot,
    target,
  };
}

describe('Native Home container controller owner', () => {
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
