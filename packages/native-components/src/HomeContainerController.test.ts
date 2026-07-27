import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
} from './HomeContainer.types';
import { HomeContainerController } from './HomeContainerController';

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

const ownerA: IHomeContainerOwner = {
  scopeKey: 'bitcoin',
  sessionId: 'session-a',
};

const ownerB: IHomeContainerOwner = {
  scopeKey: 'ethereum',
  sessionId: 'session-b',
};

const ownerC: IHomeContainerOwner = {
  scopeKey: 'solana',
  sessionId: 'session-c',
};

function buildSnapshot(accountName = 'Account 1'): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 4,
    selectedTabId: 'portfolio',
    header: {
      accountName,
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
  it('sends a monotonic full snapshot when a protocol v1 target attaches', () => {
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
    });

    expect(controller.attach(target)).toBe(true);
    expect(target.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 5 }),
    );
  });

  it('coalesces same-frame protocol v1 changes into one patch', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.setSnapshot.mockClear();

    controller.updateHeader({
      ...controller.getSnapshot().header,
      accountName: 'Account 2',
    });
    controller.updateTabSections('portfolio', [
      { id: 'stale-assets', items: [] },
    ]);
    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);

    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();

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

  it('submits consecutive protocol v2 patches without waiting for success feedback', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });

    controller.attach(target);
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ownerA, revision: 5 }),
      undefined,
    );
    jest.mocked(target.applyProtocolV2Patch!).mockClear();

    controller.updateTabSections('portfolio', [{ id: 'assets', items: [] }]);
    scheduled.shift()?.();
    controller.updateTabSections('portfolio', [
      { id: 'assets-next', items: [] },
    ]);
    scheduled.shift()?.();

    expect(target.applyProtocolV2Patch).toHaveBeenCalledTimes(2);
    expect(target.applyProtocolV2Patch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        baseRevision: 5,
        revision: 6,
      }),
      undefined,
    );
    expect(target.applyProtocolV2Patch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        baseRevision: 6,
        revision: 7,
        changes: expect.arrayContaining([
          expect.objectContaining({
            kind: 'removeSection',
            sectionId: 'assets',
          }),
          expect.objectContaining({
            kind: 'replaceSection',
            sectionId: 'assets-next',
          }),
        ]),
      }),
      undefined,
    );
  });

  it('coalesces progressive protocol v2 updates before the scheduled flush', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.applyProtocolV2Patch!).mockClear();

    for (let index = 0; index < 20; index += 1) {
      controller.updateHeader({
        ...controller.getSnapshot().header,
        balance: `$${index}`,
      });
    }

    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(target.applyProtocolV2Patch).toHaveBeenCalledTimes(1);
    expect(target.applyProtocolV2Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            kind: 'replaceShell',
            value: expect.objectContaining({ balance: '$19' }),
          }),
        ],
      }),
      undefined,
    );
  });

  it('sends one latest full snapshot when native requests resynchronization', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.setProtocolV2Snapshot!).mockClear();

    controller.updateHeader({
      ...controller.getSnapshot().header,
      balance: '$200',
    });
    expect(
      controller.handleSnapshotRequest({
        kind: 'needSnapshot',
        owner: ownerA,
        currentRevision: 4,
        reason: 'revisionGap',
      }),
    ).toBe(true);
    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();

    expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: ownerA,
        payload: expect.objectContaining({
          header: expect.objectContaining({ balance: '$200' }),
        }),
      }),
      undefined,
    );
    expect(target.applyProtocolV2Patch).not.toHaveBeenCalled();
  });

  it('ignores malformed and stale-owner resynchronization requests', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);

    expect(controller.handleSnapshotRequest('not-json')).toBe(false);
    expect(
      controller.handleSnapshotRequest({
        kind: 'needSnapshot',
        owner: ownerB,
        reason: 'ownerMismatch',
      }),
    ).toBe(false);
    expect(scheduled).toHaveLength(0);
  });

  it('drops superseded owner snapshots before the scheduled flush', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot('Account A'),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.setProtocolV2Snapshot!).mockClear();

    controller.replaceOwner(ownerB, buildSnapshot('Account B'));
    controller.replaceOwner(ownerC, buildSnapshot('Account C'));
    const slots: IHomeContainerSlots = {
      balance: { content: 'owner-c-balance' },
    };
    controller.updateSlots(slots);

    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledTimes(1);
    expect(target.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: ownerC,
        payload: expect.objectContaining({
          header: expect.objectContaining({ accountName: 'Account C' }),
        }),
      }),
      slots,
    );
  });

  it('sends protocol v3 slot-only commits as patches', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.applyProtocolV3Patch!).mockClear();

    const slots: IHomeContainerSlots = {
      balance: { content: 'next-balance', height: 58 },
    };
    controller.updateSlots(slots);
    scheduled.shift()?.();

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

  it('sends protocol v2 slot-only commits as patches', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.setProtocolV2Snapshot!).mockClear();
    jest.mocked(target.applyProtocolV2Patch!).mockClear();

    const slots: IHomeContainerSlots = {
      balance: { content: 'next-balance', height: 58 },
    };
    controller.updateSlots(slots);
    scheduled.shift()?.();

    expect(target.setProtocolV2Snapshot).not.toHaveBeenCalled();
    expect(target.applyProtocolV2Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRevision: 5,
        revision: 6,
        changes: [],
      }),
      slots,
    );
  });

  it('coalesces 20 protocol v3 progressive updates into one submission', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.applyProtocolV3Patch!).mockClear();

    for (let index = 0; index < 20; index += 1) {
      controller.updateHeader({
        ...controller.getSnapshot().header,
        balance: `$${index}`,
      });
    }

    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(target.applyProtocolV3Patch).toHaveBeenCalledTimes(1);
    expect(target.applyProtocolV3Patch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [
          expect.objectContaining({
            kind: 'replaceShell',
            value: expect.objectContaining({ balance: '$19' }),
          }),
        ],
      }),
      undefined,
    );
  });

  it('coalesces 20 protocol v3 owner replacements into the final snapshot', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    jest.mocked(target.setProtocolV3Snapshot!).mockClear();

    for (let index = 0; index < 20; index += 1) {
      controller.replaceOwner(
        {
          scopeKey: `owner-${index}`,
          sessionId: `session-${index}`,
        },
        buildSnapshot(`Account ${index}`),
      );
    }

    expect(scheduled).toHaveLength(1);
    scheduled.shift()?.();
    expect(target.setProtocolV3Snapshot).toHaveBeenCalledTimes(1);
    expect(target.setProtocolV3Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({
          scopeKey: 'owner-19',
          sessionId: 'session-19',
        }),
        payload: expect.objectContaining({
          header: expect.objectContaining({ accountName: 'Account 19' }),
        }),
      }),
      undefined,
    );
  });

  it('requires protocol v3 when configured', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialSnapshot: buildSnapshot(),
      requireProtocolV3: true,
    });

    expect(controller.attach(target)).toBe(false);
    expect(target.setProtocolV2Snapshot).not.toHaveBeenCalled();
  });

  it('records native selections without echoing a native command', () => {
    const scheduled: Array<() => void> = [];
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV3Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
      schedule: (flush) => scheduled.push(flush),
    });
    controller.attach(target);
    target.selectTab.mockClear();

    expect(controller.recordSelectedTab('history')).toBe(true);
    expect(controller.selectTab('history')).toBe(true);
    expect(target.selectTab).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
  });

  it('keeps detached updates and sends only their latest state on attach', () => {
    const target = buildTarget();
    target.getCapabilities.mockReturnValue(protocolV2Capabilities);
    const controller = new HomeContainerController({
      initialOwner: ownerA,
      initialSnapshot: buildSnapshot(),
    });

    controller.updateTabSections('history', [{ id: 'old', items: [] }]);
    controller.updateTabSections('history', [{ id: 'latest', items: [] }]);
    controller.attach(target);

    expect(target.setProtocolV2Snapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          tabs: expect.arrayContaining([
            expect.objectContaining({
              id: 'history',
              sections: [{ id: 'latest', items: [] }],
            }),
          ]),
        }),
      }),
      undefined,
    );
  });
});
