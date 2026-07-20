import fs from 'fs';
import path from 'path';

import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
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
    controller.handleTransportResult({ kind: 'applied', owner, revision: 5 });
    expect(controller.getRenderedSlotState()).toEqual({
      owner,
      revision: 5,
      slots: firstSlots,
    });

    controller.updateSlots(secondSlots);
    expect(controller.getRenderedSlotState()?.slots).toBe(firstSlots);
    scheduled.shift()?.();
    expect(controller.getRenderedSlotState()?.slots).toBe(firstSlots);

    controller.handleTransportResult({ kind: 'applied', owner, revision: 6 });
    expect(controller.getRenderedSlotState()).toEqual({
      owner,
      revision: 6,
      slots: secondSlots,
    });
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
      'header.actions.isEmpty() && header.actionLayout != "loading"',
    );
    expect(androidSource).toContain(
      'header.actionLayout != "zeroBalance" && header.actionLayout != "loading"',
    );
    expect(androidSource).toContain(
      'return (actionHeightDelta - 14).coerceAtLeast(0)',
    );
  });
});
