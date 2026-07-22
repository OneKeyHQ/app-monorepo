import fs from 'fs';
import path from 'path';

import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerCapabilities,
  type IHomeContainerRef,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
} from './HomeContainer.types';
import {
  HOME_CONTAINER_TRANSPORT_ACK_DEADLINE_MS,
  HomeContainerController,
} from './HomeContainerController';
import { resolveHomeContainerSlots } from './HomeContainerSlotPresentation';

const capabilities: IHomeContainerCapabilities = {
  schemaVersions: [HOME_CONTAINER_SCHEMA_VERSION],
  tabIds: ['portfolio', 'perps', 'defi', 'nft', 'history'],
  supportsPatches: true,
  supportsAtomicPatches: true,
  supportsNativeRefresh: true,
  supportsHorizontalPaging: true,
};

const protocolV2Capabilities: IHomeContainerCapabilities = {
  ...capabilities,
  protocolVersions: [1, 2],
  preferredProtocol: 2,
};

const protocolV3Capabilities: IHomeContainerCapabilities = {
  ...capabilities,
  protocolVersions: [1, 2, 3],
  preferredProtocol: 3,
};

function buildSnapshot(): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 4,
    selectedTabId: 'portfolio',
    header: {
      accountName: 'Account 1',
      balance: '$100',
      actions: [],
      banners: [],
    },
    tabs: [
      {
        id: 'portfolio',
        title: 'Portfolio',
        destination: 'inline',
        sections: [],
      },
      { id: 'perps', title: 'Perps', destination: 'inline', sections: [] },
      { id: 'defi', title: 'DeFi', destination: 'inline', sections: [] },
      { id: 'nft', title: 'NFT', destination: 'inline', sections: [] },
      {
        id: 'history',
        title: 'History',
        destination: 'inline',
        sections: [],
      },
    ],
    theme: {
      backgroundColor: '#FFFFFF',
      cardColor: '#F5F5F5',
      dividerColor: '#E5E5E5',
      primaryTextColor: '#111111',
      secondaryTextColor: '#666666',
      accentColor: '#5B5BD6',
      positiveColor: '#087A55',
      negativeColor: '#D92D20',
    },
  };
}

function buildHandoffSnapshot(): IHomeContainerSnapshot {
  const snapshot = buildSnapshot();
  return {
    ...snapshot,
    tabs: snapshot.tabs.map((tab) =>
      tab.id === 'perps'
        ? {
            id: tab.id,
            title: tab.title,
            destination: 'handoff',
            handoffCommandId: 'home.perps.openWeb',
            sections: [],
          }
        : tab,
    ),
  };
}

function buildTarget() {
  const target: jest.Mocked<IHomeContainerRef> = {
    setSnapshot: jest.fn(),
    applyPatch: jest.fn(),
    setProtocolV2Snapshot: jest.fn(),
    applyProtocolV2Patch: jest.fn(),
    setProtocolV3Snapshot: jest.fn(),
    applyProtocolV3Patch: jest.fn(),
    completeRefresh: jest.fn(),
    selectTab: jest.fn(),
    getCapabilities: jest.fn(() => capabilities),
  };
  return target;
}

describe('HomeContainerController', () => {
  it('sends a monotonic full snapshot when the native target attaches', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(true);
    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 5 }),
    );
  });

  it('coalesces same-turn tab updates into one patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    controller.updateTabSections('portfolio', [
      { id: 'assets-next', items: [] },
    ]);
    controller.updateTabSections('nft', [{ id: 'collectibles', items: [] }]);

    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(target.applyPatch).toHaveBeenCalledTimes(1);
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 6,
        tabs: [
          {
            tabId: 'portfolio',
            sections: [{ id: 'assets-next', items: [] }],
          },
          {
            tabId: 'nft',
            sections: [{ id: 'collectibles', items: [] }],
          },
        ],
      }),
    );
  });

  it('preserves the selected market category in an atomic tab patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [
      {
        id: 'market',
        title: 'Market',
        items: [
          {
            id: 'market-tabs',
            renderer: 'marketTabs',
            title: 'Market',
            segments: [
              {
                id: 'watchlist',
                title: 'Favorites',
                leadingIcon: 'star',
                iconOnly: true,
                selected: false,
                actionId: 'home.widget.market.category:watchlist',
              },
              {
                id: 'trending',
                title: 'Trending',
                selected: true,
                actionId: 'home.widget.market.category:trending',
              },
            ],
          },
        ],
      },
    ]);

    scheduled[0]();
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: [
          expect.objectContaining({
            tabId: 'portfolio',
            sections: [
              expect.objectContaining({
                items: [
                  expect.objectContaining({
                    segments: [
                      expect.objectContaining({ selected: false }),
                      expect.objectContaining({ selected: true }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('folds tab and header changes into one incremental patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    controller.updateHeader({
      accountName: 'Account 2',
      balance: '$200',
      actions: [],
      banners: [],
    });

    scheduled[0]();
    expect(target.setSnapshot).not.toHaveBeenCalled();
    expect(target.applyPatch).toHaveBeenCalledTimes(1);
    expect(target.applyPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 6,
        header: expect.objectContaining({ accountName: 'Account 2' }),
        tabs: [
          {
            tabId: 'portfolio',
            sections: [{ id: 'assets', items: [] }],
          },
        ],
      }),
    );
  });

  it('keeps detached updates and sends their latest state on attach', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    controller.updateTabSections('history', [{ id: 'today', items: [] }]);
    controller.attach(target);

    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tabs: expect.arrayContaining([
          expect.objectContaining({
            id: 'history',
            sections: [{ id: 'today', items: [] }],
          }),
        ]),
      }),
    );
  });

  it('uses full snapshots for an older native patch capability', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue({
      ...capabilities,
      supportsAtomicPatches: undefined,
    });
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    scheduled[0]();

    expect(target.applyPatch).not.toHaveBeenCalled();
    expect(target.setSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not send protocol v1 transport updates for React-only slots', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateSlots({ balance: { content: 'slot' } });

    expect(scheduled).toHaveLength(0);
    expect(target.setSnapshot).not.toHaveBeenCalled();
    expect(target.applyPatch).not.toHaveBeenCalled();
  });

  it('rejects a native target that cannot render the complete snapshot', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue({
      ...capabilities,
      tabIds: ['portfolio'],
    });
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(false);
    expect(target.setSnapshot).not.toHaveBeenCalled();
  });

  it('records native paging without issuing a second native command', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });
    controller.attach(target);

    expect(controller.recordSelectedTab('history')).toBe(true);
    expect(controller.getSnapshot().selectedTabId).toBe('history');
    expect(target.selectTab).not.toHaveBeenCalled();
  });

  it('confirms rapid native selections without echoing stale commands', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    controller.handleTransportResult({ kind: 'applied', owner, revision: 5 });
    target.selectTab.mockClear();

    expect(controller.recordSelectedTab('perps')).toBe(true);
    expect(controller.recordSelectedTab('defi')).toBe(true);
    expect(controller.selectTab('perps')).toBe(true);
    expect(controller.selectTab('defi')).toBe(true);

    expect(target.selectTab).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            kind: 'replaceNavigation',
            value: expect.objectContaining({ selectedTabId: 'defi' }),
          }),
        ],
      }),
      undefined,
    );
  });

  it('presents Store-originated tab changes without treating them as native confirmations', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });
    controller.attach(target);
    target.selectTab.mockClear();

    expect(controller.selectTab('history', false)).toBe(true);

    expect(target.selectTab).toHaveBeenCalledWith('history', false);
  });

  it('keeps handoff tabs out of inline selection and section updates', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildHandoffSnapshot(),
    });
    controller.attach(target);

    expect(controller.selectTab('perps')).toBe(false);
    expect(controller.recordSelectedTab('perps')).toBe(false);
    expect(controller.updateTabSections('perps', [])).toBe(false);
    expect(controller.getSnapshot().selectedTabId).toBe('portfolio');
  });

  it('rejects snapshots that select a handoff tab or give it sections', () => {
    const target = buildTarget();
    const handoffSnapshot = buildHandoffSnapshot();
    const selectedHandoff = {
      ...handoffSnapshot,
      selectedTabId: 'perps' as const,
    };
    const handoffWithSections = {
      ...handoffSnapshot,
      tabs: handoffSnapshot.tabs.map((tab) =>
        tab.id === 'perps'
          ? { ...tab, sections: [{ id: 'invalid', items: [] }] }
          : tab,
      ),
    };

    expect(
      new HomeContainerController({ initialSnapshot: selectedHandoff }).attach(
        target,
      ),
    ).toBe(false);
    expect(
      new HomeContainerController({
        initialSnapshot: handoffWithSections,
      }).attach(target),
    ).toBe(false);
  });

  it('keeps the current owner and snapshot when an owner replacement is invalid', () => {
    const ownerA = { scopeKey: 'scope-a', sessionId: 'session-a' };
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
    });
    const currentSnapshot = controller.getSnapshot();
    const invalidSnapshot = {
      ...buildHandoffSnapshot(),
      selectedTabId: 'perps' as const,
    };

    controller.replaceOwner(
      { scopeKey: 'scope-b', sessionId: 'session-b' },
      invalidSnapshot,
    );

    expect(controller.getOwner()).toEqual(ownerA);
    expect(controller.getSnapshot()).toBe(currentSnapshot);
  });

  it('negotiates protocol v1 when protocolVersions is absent', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    controller.attach(target);

    expect(controller.getProtocolVersion()).toBe(1);
    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.not.objectContaining({ protocolVersion: 2 }),
    );
  });

  it('falls back to protocol v1 when preferred v2 is unavailable', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue({
      ...capabilities,
      protocolVersions: [1],
      preferredProtocol: 2,
    });
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(true);
    expect(controller.getProtocolVersion()).toBe(1);
  });

  it('negotiates protocol v3 and transports Store revision vectors independently', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const sections = {
      portfolio: 1,
      perps: 1,
      defi: 1,
      nft: 1,
      history: 1,
      market: 1,
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      initialProtocolV3Revisions: {
        storeCommitId: 10,
        presentationRevisions: {
          shell: 2,
          navigation: 3,
          sections,
        },
        authorityRevisions: {
          shellCommands: 1,
          tabApplicability: 4,
          sectionCommands: sections,
        },
      },
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });

    expect(controller.attach(target)).toBe(true);
    expect(controller.getProtocolVersion()).toBe(3);
    expect(target.setProtocolV3Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolVersion: 3,
        identity: { ...owner, storeCommitId: 10 },
        transportRevision: 5,
        authorityRevisions: expect.objectContaining({ tabApplicability: 4 }),
      }),
      undefined,
    );
    controller.handleTransportResult(
      JSON.stringify({ kind: 'applied', owner, revision: 5 }),
    );
    controller.setProtocolV3RevisionState({
      storeCommitId: 11,
      presentationRevisions: {
        shell: 3,
        navigation: 3,
        sections,
      },
      authorityRevisions: {
        shellCommands: 1,
        tabApplicability: 4,
        sectionCommands: sections,
      },
    });
    controller.updateHeader({
      accountName: 'Account 1',
      balance: '$101',
      actions: [],
      banners: [],
    });
    scheduled.shift()?.();

    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        baseTransportRevision: 5,
        transportRevision: 6,
        identity: { ...owner, storeCommitId: 11 },
        presentationRevisions: expect.objectContaining({ shell: 3 }),
        authorityRevisions: expect.objectContaining({
          shellCommands: 1,
          tabApplicability: 4,
        }),
        changes: [expect.objectContaining({ kind: 'replaceShell' })],
      }),
      undefined,
    );
  });

  it('transports a v3 slot-only commit as an empty patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });

    expect(controller.attach(target)).toBe(true);
    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner,
        revision: 5,
      }),
    ).toBe(true);
    jest.mocked(target.setProtocolV3Snapshot!).mockClear();
    const slots: IHomeContainerSlots = {
      balance: { content: 'confirmed', height: 58 },
    };

    controller.updateSlots(slots);
    scheduled.shift()?.();

    expect(target.setProtocolV3Snapshot).not.toHaveBeenCalled();
    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        baseTransportRevision: 5,
        transportRevision: 6,
        changes: [],
        requiredSlotRevisions: { 'header.balance': 1 },
      }),
      slots,
    );
  });

  it('requires only the slot whose externally owned revision changed', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const sections = {
      portfolio: 1,
      perps: 1,
      defi: 1,
      nft: 1,
      history: 1,
      market: 1,
    };
    const initialSlots: IHomeContainerSlots = {
      balance: { content: 'initial', height: 58 },
      headerActionRow: { content: 'actions-1', height: 96 },
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      initialSlots,
      initialProtocolV3Revisions: {
        storeCommitId: 10,
        presentationRevisions: {
          shell: 1,
          navigation: 1,
          sections,
        },
        authorityRevisions: {
          shellCommands: 1,
          tabApplicability: 1,
          sectionCommands: sections,
        },
        slotRevisions: {
          'header.balance': 7,
          'header.action-row': 4,
        },
      },
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });

    expect(controller.attach(target)).toBe(true);
    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner,
        revision: 5,
      }),
    ).toBe(true);
    controller.setProtocolV3RevisionState({
      storeCommitId: 11,
      presentationRevisions: {
        shell: 1,
        navigation: 1,
        sections,
      },
      authorityRevisions: {
        shellCommands: 1,
        tabApplicability: 1,
        sectionCommands: sections,
      },
      slotRevisions: {
        'header.balance': 7,
        'header.action-row': 5,
      },
    });
    const nextSlots: IHomeContainerSlots = {
      balance: { content: 'next', height: 58 },
      headerActionRow: { content: 'actions-2', height: 96 },
    };
    controller.updateSlots(nextSlots);
    scheduled.shift()?.();

    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [],
        requiredSlotRevisions: { 'header.action-row': 5 },
      }),
      nextSlots,
    );
  });

  it('does not require a removed action slot when backup state replaces it', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const sections = {
      portfolio: 1,
      perps: 1,
      defi: 1,
      nft: 1,
      history: 1,
      market: 1,
    };
    const initialSlots: IHomeContainerSlots = {
      accountRow: { content: 'account' },
      headerActionRow: { content: 'actions', height: 96 },
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      initialSlots,
      initialProtocolV3Revisions: {
        storeCommitId: 10,
        presentationRevisions: {
          shell: 1,
          navigation: 1,
          sections,
        },
        authorityRevisions: {
          shellCommands: 1,
          tabApplicability: 1,
          sectionCommands: sections,
        },
        slotRevisions: {
          'header.account-row': 1,
          'header.action-row': 1,
        },
      },
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });

    expect(controller.attach(target)).toBe(true);
    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner,
        revision: 5,
      }),
    ).toBe(true);
    controller.setProtocolV3RevisionState({
      storeCommitId: 11,
      presentationRevisions: {
        shell: 2,
        navigation: 1,
        sections,
      },
      authorityRevisions: {
        shellCommands: 1,
        tabApplicability: 1,
        sectionCommands: sections,
      },
      slotRevisions: {
        'header.account-row': 1,
        'content.state.portfolio': 2,
      },
    });
    const backupSlots: IHomeContainerSlots = {
      accountRow: { content: 'account' },
      contentStates: {
        portfolio: { content: 'backup', height: 320 },
      },
    };
    controller.updateSlots(backupSlots);
    scheduled.shift()?.();

    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredSlotRevisions: { 'content.state.portfolio': 2 },
      }),
      backupSlots,
    );
  });

  it('rejects a native binary without protocol v3 when v3 is required', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
    });

    expect(controller.attach(target)).toBe(false);
    expect(target.setSnapshot).not.toHaveBeenCalled();
    expect(target.setProtocolV2Snapshot).not.toHaveBeenCalled();
  });

  it('allows only one protocol v2 transaction in flight and coalesces pending changes', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: { scopeKey: 'scope-1', sessionId: 'session-1' },
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });

    controller.attach(target);
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'snapshot',
        protocolVersion: 2,
        schemaVersion: 2,
        revision: 5,
      }),
      undefined,
    );

    controller.updateHeader({
      accountName: 'Account 2',
      balance: '$200',
      actions: [],
      banners: [],
    });
    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    expect(scheduled).toHaveLength(0);
    expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();

    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner: { scopeKey: 'scope-1', sessionId: 'session-1' },
        revision: 5,
      }),
    ).toBe(true);
    expect(scheduled).toHaveLength(1);
    scheduled[0]();

    expect(target.applyProtocolV2Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'patch',
        baseRevision: 5,
        revision: 6,
        changes: expect.arrayContaining([
          expect.objectContaining({ kind: 'replaceShell' }),
          expect.objectContaining({
            kind: 'replaceSection',
            tabId: 'portfolio',
            sectionId: 'assets',
            index: 0,
          }),
        ]),
      }),
      undefined,
    );
  });

  it('changes an inline tab to handoff without emitting rejected section changes', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const initialSnapshot = buildSnapshot();
    initialSnapshot.tabs = initialSnapshot.tabs.map((tab) =>
      tab.id === 'perps'
        ? { ...tab, sections: [{ id: 'positions', items: [] }] }
        : tab,
    );
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot,
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);

    controller.updateTabs(buildHandoffSnapshot().tabs);
    controller.handleTransportResult({ kind: 'applied', owner, revision: 5 });
    scheduled.shift()?.();

    const patch = jest.mocked(target.applyProtocolV2Patch!).mock.calls[0]?.[0];
    expect(patch?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'replaceNavigation' }),
      ]),
    );
    expect(
      patch?.changes.some(
        (change) =>
          'tabId' in change &&
          change.tabId === 'perps' &&
          (change.kind === 'replaceSection' || change.kind === 'removeSection'),
      ),
    ).toBe(false);
  });

  it('requests a bounded full resync after needSnapshot', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.setProtocolV2Snapshot!).mockClear();

    expect(
      controller.handleTransportResult({
        kind: 'needSnapshot',
        owner,
        currentRevision: 4,
        reason: 'revisionGap',
      }),
    ).toBe(true);
    expect(scheduled).toHaveLength(1);
    scheduled[0]();

    expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);
    expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();
  });

  it('publishes only the slots captured by an acknowledged transaction', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const firstSlots: IHomeContainerSlots = {
      balance: { content: 'first', height: 58 },
    };
    const secondSlots: IHomeContainerSlots = {
      balance: { content: 'second', height: 58 },
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.updateSlots(firstSlots);
    controller.attach(target);
    expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 5 }),
      firstSlots,
    );
    controller.handleTransportResult({ kind: 'applied', owner, revision: 5 });
    expect(controller.getRenderedSlotState()).toEqual({
      owner,
      revision: 5,
      slots: firstSlots,
    });

    controller.updateSlots(secondSlots);
    expect(controller.getRenderedSlotState()?.slots).toBe(firstSlots);
    scheduled.shift()?.();
    expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 6 }),
      secondSlots,
    );
    expect(controller.getRenderedSlotState()?.slots).toBe(firstSlots);

    controller.handleTransportResult({ kind: 'applied', owner, revision: 6 });
    expect(controller.getRenderedSlotState()).toEqual({
      owner,
      revision: 6,
      slots: secondSlots,
    });
  });

  it('keeps an equivalent repeated attach idempotent but reattaches a new target', () => {
    const target = buildTarget();
    const replacementTarget = buildTarget();
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const slots: IHomeContainerSlots = {
      balance: { content: 'settled', height: 58 },
      contentHeaders: {
        portfolio: { content: 'Tokens', height: 56 },
      },
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
    });
    controller.updateSlots(slots);

    expect(controller.attach(target, protocolV2Capabilities)).toBe(true);
    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner,
        revision: 5,
      }),
    ).toBe(true);
    const renderedSlotState = controller.getRenderedSlotState();

    expect(
      controller.attach(target, {
        ...protocolV2Capabilities,
        protocolVersions: [...(protocolV2Capabilities.protocolVersions ?? [])],
        schemaVersions: [...protocolV2Capabilities.schemaVersions],
        tabIds: [...protocolV2Capabilities.tabIds],
      }),
    ).toBe(true);
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);
    expect(controller.getRenderedSlotState()).toBe(renderedSlotState);
    expect(controller.getSnapshot().revision).toBe(5);

    expect(controller.attach(replacementTarget, protocolV2Capabilities)).toBe(
      true,
    );
    expect(replacementTarget.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 6 }),
      slots,
    );
  });

  it('submits captured slots with an incremental business patch', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const owner = { scopeKey: 'scope-1', sessionId: 'session-1' };
    const firstSlots: IHomeContainerSlots = {
      balance: { content: 'first', height: 58 },
    };
    const secondSlots: IHomeContainerSlots = {
      balance: { content: 'second', height: 58 },
    };
    const controller = new HomeContainerController({
      initialOwner: owner,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.updateSlots(firstSlots);
    controller.attach(target);
    controller.handleTransportResult({ kind: 'applied', owner, revision: 5 });

    controller.updateHeader({
      accountName: 'Account 2',
      balance: '$200',
      actions: [],
      banners: [],
    });
    controller.updateSlots(secondSlots);
    scheduled.shift()?.();

    expect(target.applyProtocolV2Patch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseRevision: 5,
        revision: 6,
        changes: [expect.objectContaining({ kind: 'replaceShell' })],
      }),
      secondSlots,
    );
  });

  it('never captures the previous owner slots after an owner switch', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const ownerA = { scopeKey: 'scope-a', sessionId: 'session-a' };
    const ownerB = { scopeKey: 'scope-b', sessionId: 'session-b' };
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
    });
    controller.updateSlots({ balance: { content: 'owner-a' } });
    controller.attach(target);
    controller.handleTransportResult({
      kind: 'applied',
      owner: ownerA,
      revision: 5,
    });
    expect(controller.getRenderedSlotState()?.owner).toEqual(ownerA);

    controller.replaceOwner(ownerB, buildSnapshot());
    controller.flushNow();
    controller.handleTransportResult({
      kind: 'applied',
      owner: ownerB,
      revision: 6,
    });

    expect(controller.getRenderedSlotState()).toBeUndefined();
  });

  it('settles a replacement owner after the previous owner acknowledgement arrives late', () => {
    const scheduled: (() => void)[] = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const ownerA = { scopeKey: 'all-networks', sessionId: 'session-a' };
    const ownerB = { scopeKey: 'bitcoin', sessionId: 'session-b' };
    const loadingSlots: IHomeContainerSlots = {
      balance: { content: 'bitcoin-loading', height: 58 },
      headerActionRow: { content: 'bitcoin-loading-actions', height: 82 },
      contentStates: {
        portfolio: { content: 'bitcoin-loading-tokens', height: 320 },
      },
    };
    const settledSlots: IHomeContainerSlots = {
      balance: { content: 'bitcoin-settled', height: 58 },
      headerActionRow: { content: 'bitcoin-actions', height: 62 },
      contentHeaders: {
        portfolio: { content: 'Tokens', height: 56 },
      },
      tabAccessories: {
        portfolio: { content: 'manage-tokens', height: 36 },
      },
    };
    const bitcoinLoadingSnapshot: IHomeContainerSnapshot = {
      ...buildSnapshot(),
      header: {
        accountName: 'Bitcoin Account',
        balance: '',
        actionLayout: 'loading',
        actionRowHeight: 82,
        actions: [],
        banners: [],
      },
      tabs: buildSnapshot().tabs.filter(
        (tab) => tab.id === 'portfolio' || tab.id === 'history',
      ),
    };
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });

    controller.attach(target);
    expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: ownerA, revision: 5 }),
      undefined,
    );

    controller.replaceOwner(ownerB, bitcoinLoadingSnapshot);
    controller.updateSlots(loadingSlots);
    scheduled.shift()?.();
    expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: ownerB, revision: 6 }),
      loadingSlots,
    );

    controller.updateHeader({
      ...bitcoinLoadingSnapshot.header,
      balance: '$1',
      actionLayout: 'standard',
      actionRowHeight: 62,
      actions: [
        {
          actionId: 'home.header.send',
          icon: 'send',
          id: 'send',
          title: 'Send',
        },
      ],
    });
    controller.updateTabSections('portfolio', [
      {
        id: 'assets-bitcoin',
        title: 'Tokens',
        items: [{ id: 'btc', renderer: 'asset', title: 'BTC' }],
      },
    ]);
    controller.updateSlots(settledSlots);

    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner: ownerA,
        revision: 5,
      }),
    ).toBe(false);
    expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();

    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner: ownerB,
        revision: 6,
      }),
    ).toBe(true);
    scheduled.shift()?.();
    expect(target.applyProtocolV2Patch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: ownerB,
        baseRevision: 6,
        revision: 7,
        changes: expect.arrayContaining([
          expect.objectContaining({ kind: 'replaceShell' }),
          expect.objectContaining({
            kind: 'replaceSection',
            tabId: 'portfolio',
            sectionId: 'assets-bitcoin',
          }),
        ]),
      }),
      settledSlots,
    );

    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner: ownerB,
        revision: 7,
      }),
    ).toBe(true);
    expect(controller.getRenderedSlotState()).toEqual({
      owner: ownerB,
      revision: 7,
      slots: settledSlots,
    });
    expect(controller.getSnapshot()).toMatchObject({
      header: {
        accountName: 'Bitcoin Account',
        actionLayout: 'standard',
        actionRowHeight: 62,
        balance: '$1',
      },
      tabs: [
        {
          id: 'portfolio',
          sections: [
            {
              id: 'assets-bitcoin',
              items: [{ id: 'btc', renderer: 'asset', title: 'BTC' }],
            },
          ],
        },
        { id: 'history' },
      ],
    });
  });

  describe('protocol v2 acknowledgement recovery', () => {
    const acknowledgementDeadlineMs = HOME_CONTAINER_TRANSPORT_ACK_DEADLINE_MS;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('retries one full snapshot and then stops when acknowledgements never arrive', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const controller = new HomeContainerController({
        initialOwner: { scopeKey: 'bitcoin', sessionId: 'session-timeout' },
        initialSnapshot: buildSnapshot(),
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(2);
      expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ revision: 6 }),
        undefined,
      );

      jest.advanceTimersByTime(acknowledgementDeadlineMs * 4);
      scheduled.splice(0).forEach((flush) => flush());
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(2);
      expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();
    });

    it('ignores wrong owner and revision results before the deadline recovery', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const owner = { scopeKey: 'bitcoin', sessionId: 'session-exact-ack' };
      const controller = new HomeContainerController({
        initialOwner: owner,
        initialSnapshot: buildSnapshot(),
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 4,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner: { ...owner, sessionId: 'wrong-session' },
          revision: 5,
        }),
      ).toBe(false);
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(2);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 5,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 6,
        }),
      ).toBe(true);
      expect(controller.getRenderedRevision()).toBe(6);
    });

    it('resends the queued terminal snapshot and slots after a loading transaction wedges', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const owner = { scopeKey: 'bitcoin', sessionId: 'session-terminal' };
      const loadingSnapshot = buildSnapshot();
      loadingSnapshot.header = {
        accountName: 'Bitcoin Account',
        balance: '',
        actionLayout: 'loading',
        actionRowHeight: 82,
        actions: [],
        banners: [],
      };
      const loadingSlots: IHomeContainerSlots = {
        contentStates: {
          portfolio: { content: 'loading', height: 320 },
        },
      };
      const terminalSlots: IHomeContainerSlots = {
        headerActionRow: { content: 'actions', height: 62 },
        contentHeaders: {
          portfolio: { content: 'Tokens', height: 56 },
        },
      };
      const controller = new HomeContainerController({
        initialOwner: owner,
        initialSnapshot: loadingSnapshot,
        initialSlots: loadingSlots,
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      controller.updateHeader({
        ...loadingSnapshot.header,
        balance: '$1',
        actionLayout: 'standard',
        actionRowHeight: 62,
      });
      controller.updateTabSections('portfolio', [
        {
          id: 'assets-bitcoin',
          title: 'Tokens',
          items: [{ id: 'btc', renderer: 'asset', title: 'BTC' }],
        },
      ]);
      controller.updateSlots(terminalSlots);

      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();

      expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({
          owner,
          revision: 6,
          payload: expect.objectContaining({
            header: expect.objectContaining({
              actionLayout: 'standard',
              balance: '$1',
            }),
            tabs: expect.arrayContaining([
              expect.objectContaining({
                id: 'portfolio',
                sections: [expect.objectContaining({ id: 'assets-bitcoin' })],
              }),
            ]),
          }),
        }),
        terminalSlots,
      );
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 5,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 6,
        }),
      ).toBe(true);
      expect(controller.getRenderedSlotState()).toEqual({
        owner,
        revision: 6,
        slots: terminalSlots,
      });
      const renderedSlotState = controller.getRenderedSlotState();
      expect(
        resolveHomeContainerSlots({
          acknowledgedBundle: renderedSlotState
            ? {
                owner: renderedSlotState.owner,
                semanticRevision: renderedSlotState.revision,
                slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
                slots: renderedSlotState.slots,
              }
            : undefined,
          currentBundle: {
            owner,
            semanticRevision: 6,
            slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
            slots: terminalSlots,
          },
          legacySlots: undefined,
        }),
      ).toBe(terminalSlots);
    });

    it('accepts only the latest exact late acknowledgement after recovery stops', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const owner = { scopeKey: 'bitcoin', sessionId: 'session-late-ack' };
      const slots: IHomeContainerSlots = {
        contentStates: {
          portfolio: { content: 'terminal', height: 320 },
        },
      };
      const controller = new HomeContainerController({
        initialOwner: owner,
        initialSnapshot: buildSnapshot(),
        initialSlots: slots,
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();
      jest.advanceTimersByTime(acknowledgementDeadlineMs);

      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 5,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 6,
        }),
      ).toBe(true);
      expect(controller.getRenderedSlotState()).toEqual({
        owner,
        revision: 6,
        slots,
      });
    });

    it('starts a fresh bounded cycle when new data arrives after recovery stops', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const owner = { scopeKey: 'bitcoin', sessionId: 'session-new-data' };
      const controller = new HomeContainerController({
        initialOwner: owner,
        initialSnapshot: buildSnapshot(),
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(2);

      controller.updateHeader({
        accountName: 'Updated Account',
        balance: '$2',
        actions: [],
        banners: [],
      });
      scheduled.shift()?.();
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(3);
      expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({
          revision: 7,
          payload: expect.objectContaining({
            header: expect.objectContaining({ balance: '$2' }),
          }),
        }),
        undefined,
      );
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 6,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 7,
        }),
      ).toBe(true);
    });

    it('limits every new business update to one initial send and one recovery send', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const controller = new HomeContainerController({
        initialOwner: { scopeKey: 'bitcoin', sessionId: 'session-update-cap' },
        initialSnapshot: buildSnapshot(),
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();
      jest.advanceTimersByTime(acknowledgementDeadlineMs);

      const updateCount = 3;
      for (let index = 1; index <= updateCount; index += 1) {
        controller.updateHeader({
          accountName: `Account ${index}`,
          balance: `$${index}`,
          actions: [],
          banners: [],
        });
        scheduled.shift()?.();
        jest.advanceTimersByTime(acknowledgementDeadlineMs);
        scheduled.shift()?.();
        jest.advanceTimersByTime(acknowledgementDeadlineMs);
        expect(scheduled).toHaveLength(0);
      }

      jest.advanceTimersByTime(acknowledgementDeadlineMs * 20);
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(
        2 + updateCount * 2,
      );
      expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();
    });

    it('cancels the old owner deadline and never commits its late result', () => {
      const scheduled: (() => void)[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const ownerA = { scopeKey: 'all-networks', sessionId: 'session-owner-a' };
      const ownerB = { scopeKey: 'bitcoin', sessionId: 'session-owner-b' };
      const controller = new HomeContainerController({
        initialOwner: ownerA,
        initialSnapshot: buildSnapshot(),
        schedule: (flush) => scheduled.push(flush),
      });

      controller.attach(target);
      controller.replaceOwner(ownerB, buildSnapshot());
      scheduled.shift()?.();
      expect(target.setProtocolV2Snapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ owner: ownerB, revision: 6 }),
        undefined,
      );

      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner: ownerA,
          revision: 5,
        }),
      ).toBe(false);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner: ownerB,
          revision: 6,
        }),
      ).toBe(true);
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(2);
    });

    it('reports only hashed owner identity and slot barrier state in debug diagnostics', () => {
      const scheduled: (() => void)[] = [];
      const diagnostics: unknown[] = [];
      const target = buildTarget();
      target.getCapabilities.mockReturnValue(protocolV2Capabilities);
      const owner = { scopeKey: 'bitcoin', sessionId: 'sensitive-session-id' };
      const controller = new HomeContainerController({
        initialOwner: owner,
        initialSnapshot: buildSnapshot(),
        initialSlots: {
          contentStates: {
            portfolio: { content: 'loading', height: 320 },
          },
        },
        schedule: (flush) => scheduled.push(flush),
        diagnosticsEnabled: true,
        reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });

      controller.attach(target);
      expect(
        controller.handleTransportResult({
          kind: 'applied',
          owner,
          revision: 4,
        }),
      ).toBe(false);
      jest.advanceTimersByTime(acknowledgementDeadlineMs);
      scheduled.shift()?.();

      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'result',
            revision: 4,
            inFlightRevision: 5,
            resultKind: 'applied',
            exactMatch: false,
            mismatch: 'revision',
            portfolioSlot: {
              current: 'content',
              acknowledged: 'absent',
              presentation: 'reserved',
            },
          }),
          expect.objectContaining({
            event: 'deadline',
            revision: 5,
            inFlightAgeMs: acknowledgementDeadlineMs,
            resultKind: 'deadline',
          }),
          expect.objectContaining({
            event: 'recoverySnapshot',
            revision: 6,
            resultKind: 'recoverySnapshot',
          }),
        ]),
      );
      const serializedDiagnostics = JSON.stringify(diagnostics);
      expect(serializedDiagnostics).not.toContain(owner.sessionId);
      expect(serializedDiagnostics).not.toContain(owner.scopeKey);
      expect(serializedDiagnostics).toMatch(/"sessionHash":"[0-9a-f]{8}"/);
    });
  });

  it('ignores stale acknowledgements from another owner', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: { scopeKey: 'scope-1', sessionId: 'session-1' },
      initialSnapshot: buildSnapshot(),
    });
    controller.attach(target);

    expect(
      controller.handleTransportResult({
        kind: 'applied',
        owner: { scopeKey: 'scope-1', sessionId: 'old-session' },
        revision: 5,
      }),
    ).toBe(false);
  });

  it('rejects malformed transport results without throwing', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: { scopeKey: 'scope-1', sessionId: 'session-1' },
      initialSnapshot: buildSnapshot(),
    });
    controller.attach(target);

    expect(controller.handleTransportResult('{"kind":"applied"}')).toBe(false);
    expect(controller.handleTransportResult('not-json')).toBe(false);
  });
});

describe('iOS HomeContainer slot cell-kind updates', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerView.swift'),
    'utf8',
  );

  it('reloads state rows only when their mounted slot key changes', () => {
    expect(source).toContain('.symmetricDifference(nextMountedSlotKeys)');
    expect(source).toContain('reloadsStateSlotRows: reloadsStateSlotRows');
    expect(source).toContain(
      'nextSnapshot.reloadItems(cellUpdatePlan.reloadRowIds)',
    );
  });

  it('keeps ordinary content updates on the reconfigure path', () => {
    expect(source).toContain('.subtracting(reloadRowIdSet)');
    expect(source).toContain(
      'nextSnapshot.reconfigureItems(cellUpdatePlan.reconfigureRowIds)',
    );
  });

  it('invalidates a stable state cell height without replacing the cell', () => {
    expect(source).toContain(
      'let updatesStateRowHeight = stateRowHeightChanged(',
    );
    expect(source).toContain('if updatesStateRowHeight {');
    expect(source).toContain('UIView.performWithoutAnimation {');
    expect(source).toContain('self.tableView.beginUpdates()');
    expect(source).toContain('self.tableView.endUpdates()');
  });

  it('asks the cell provider for a slot-host cell after the reload', () => {
    expect(source).toMatch(
      /case \.item\(let item\):[\s\S]*?if let key = self\.slotKey\(for: row\)[\s\S]*?"slot-host"/,
    );
    expect(source).toContain('self.refreshVisibleSlotHosts()');
  });
});

describe('iOS HomeContainer tab automation identifiers', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerView.swift'),
    'utf8',
  );
  const surfaceSource = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerSurfaceComponentView.mm'),
    'utf8',
  );
  it('maps every product tab to a stable automation identifier', () => {
    expect(source).toContain('case "portfolio": return "native-home-tab-spot"');
    expect(source).toContain('case "perps": return "native-home-tab-perps"');
    expect(source).toContain('case "defi": return "native-home-tab-defi"');
    expect(source).toContain('case "nft": return "native-home-tab-nft"');
    expect(source).toContain(
      'case "history": return "native-home-tab-history"',
    );
  });

  it('keeps the product title as the accessibility label', () => {
    expect(source).toContain('button.accessibilityLabel = tab.title');
    expect(source).toContain(
      'HomeContainerAccessibilityIdentifier.tabIdentifier(for: tab.id)',
    );
  });

  it('uses natural UIKit traversal instead of a partial accessibility element list', () => {
    expect(source).toMatch(
      /private final class HomeContainerTabsView: UIView \{[\s\S]*?override init\(frame: CGRect\) \{[\s\S]*?isAccessibilityElement = false/,
    );
    expect(source).not.toContain('accessibilityElements =');
    expect(surfaceSource).not.toContain('- (NSArray *)accessibilityElements');
  });

  it('exposes VoiceOver selection without activating UIKit selected styling', () => {
    expect(source).not.toContain('button.isSelected = isSelected');
    expect(source).toContain('button.accessibilityTraits.insert(.selected)');
    expect(source).toContain('button.accessibilityTraits.remove(.selected)');
  });

  it('rebuilds buttons from the visible tab model and only selects the tab', () => {
    expect(source).toContain('buttons.removeAll()');
    expect(source).toContain('view.removeFromSuperview()');
    expect(source).toContain('self?.onSelect?(tab.id)');
  });

  it('emits control selections immediately and keeps Store commands presentation-only', () => {
    expect(source).toContain('self?.selectTabFromControl(tabId)');
    expect(source).toContain('emitTabSelection(tabId: tabId)');
    expect(source).toMatch(
      /func selectTab\(_ tabId: String, animated: Bool\)[\s\S]*?moveToTab\(tabId, animated: animated, notify: false\)/,
    );
  });
});

describe('native HomeContainer background authority', () => {
  const iosSource = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerView.swift'),
    'utf8',
  );
  const androidSource = fs.readFileSync(
    path.join(
      __dirname,
      '../android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt',
    ),
    'utf8',
  );

  it('keeps Android Store tab commands presentation-only', () => {
    expect(androidSource).toMatch(
      /fun selectTab\(tabId: String, animated: Boolean\)[\s\S]*?moveToTab\(tabId, animated, false\)/,
    );
    expect(androidSource).toContain(
      'if (notify && didChangeTab) emitTabSelection(tabId)',
    );
  });

  it('keeps an iOS snapshot authoritative over a late fallback setter', () => {
    const fallbackBlock = iosSource.slice(
      iosSource.indexOf('func setFallbackBackgroundColor'),
      iosSource.indexOf('func setDebugOverlayEnabled'),
    );
    expect(fallbackBlock).toContain(
      'guard let self, self.snapshot == nil else { return }',
    );
    expect(fallbackBlock).toContain('self.backgroundColor = color');
    expect(fallbackBlock).toContain('self.pager.backgroundColor = color');
    expect(iosSource).toMatch(
      /snapshot = next[\s\S]*?backgroundColor = UIColor\([\s\S]*?next\.theme\.backgroundColor[\s\S]*?pager\.backgroundColor = backgroundColor/,
    );
  });

  it('keeps an Android snapshot authoritative over a late fallback setter', () => {
    const fallbackBlock = androidSource.slice(
      androidSource.indexOf('fun setFallbackBackgroundColor'),
      androidSource.indexOf('fun setDebugOverlayEnabled'),
    );
    expect(fallbackBlock).toContain('if (snapshot == null)');
    expect(fallbackBlock).toContain('setBackgroundColor(color)');
    expect(androidSource).toContain(
      'private var fallbackBackgroundColor = Color.WHITE',
    );
    expect(androidSource).toMatch(
      /snapshot = next[\s\S]*?setBackgroundColor\(parseHomeContainerColor\(next\.theme\.backgroundColor, Color\.WHITE\)\)/,
    );
  });
});

describe('native HomeContainer loading action-row geometry', () => {
  const iosSource = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerView.swift'),
    'utf8',
  );
  const androidSource = fs.readFileSync(
    path.join(
      __dirname,
      '../android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt',
    ),
    'utf8',
  );
  const typesSource = fs.readFileSync(
    path.join(__dirname, 'HomeContainer.types.ts'),
    'utf8',
  );

  it('keeps the iOS loading slot mounted with zero-balance geometry', () => {
    expect(typesSource).toMatch(
      /IHomeContainerHeaderActionLayout[\s\S]*?'loading'[\s\S]*?'standard'[\s\S]*?'zeroBalance'/,
    );
    expect(iosSource).toContain(
      'header.actions.isEmpty && header.actionLayout != "loading"',
    );
    expect(iosSource).toContain(
      'header.actionLayout == "zeroBalance" || header.actionLayout == "loading"',
    );
    expect(iosSource).toContain(
      'HomeContainerMetrics.legacyABZeroBalanceActionTrailingCompaction',
    );
  });

  it('keeps the Android loading slot mounted with zero-balance geometry', () => {
    expect(androidSource).toContain(
      'private fun updateActionRowVisibility(header: HomeContainerHeader? = null)',
    );
    expect(androidSource).toContain(
      '!hasMountedSlot && currentHeader.actions.isEmpty() && currentHeader.actionLayout != "loading"',
    );
    expect(androidSource).toContain(
      'header.actionLayout != "zeroBalance" && header.actionLayout != "loading"',
    );
    expect(androidSource).toContain(
      'return (actionHeightDelta - 14).coerceAtLeast(0)',
    );
  });
});

describe('native HomeContainer section command authority', () => {
  const iosSource = fs.readFileSync(
    path.join(__dirname, '../ios/HomeContainerView.swift'),
    'utf8',
  );
  const androidSource = fs.readFileSync(
    path.join(
      __dirname,
      '../android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt',
    ),
    'utf8',
  );

  it('routes embedded Market rows through the Market command revision', () => {
    expect(iosSource).toContain('actionId.hasPrefix("home.market.")');
    expect(androidSource).toContain('actionId.startsWith("home.market.")');
  });
});
