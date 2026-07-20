import fs from 'fs';
import path from 'path';

import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import {
  type INativeHomeContainerControllerOwner,
  acquireNativeHomeContainerController,
} from '../../nativeHomeContainerControllerOwner';
import {
  guardHomeNativeIntent,
  handleHomeNativeLegacyHandoff,
  isHomeNativeLegacyHandoffAvailable,
} from '../native/homeNativeIntentGuard';
import {
  createHomeNativeSlotBundle,
  isHomeNativeSlotBundleCurrent,
} from '../native/homeNativeSlotBundle';

const owner = { scopeKey: 'wallet:account:all', sessionId: 'session-1' };

function buildSnapshot(): IHomeContainerSnapshot {
  return {
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    revision: 8,
    selectedTabId: 'portfolio',
    header: { accountName: 'A', balance: '$1', actions: [], banners: [] },
    tabs: [
      {
        id: 'portfolio',
        title: 'Spot',
        destination: 'inline',
        sections: [
          {
            id: 'actions',
            items: [
              {
                id: 'send',
                renderer: 'action',
                title: 'Send',
                actionId: 'home.send',
              },
            ],
          },
        ],
      },
    ],
    theme: {
      backgroundColor: '#fff',
      cardColor: '#eee',
      dividerColor: '#ddd',
      primaryTextColor: '#111',
      secondaryTextColor: '#666',
      accentColor: '#55f',
      positiveColor: '#080',
      negativeColor: '#d00',
    },
  };
}

describe('home native intent guard and slot bundle', () => {
  it('rejects stale action intents even when the command still exists', () => {
    const result = guardHomeNativeIntent({
      currentOwner: owner,
      currentRevision: 8,
      currentSnapshot: buildSnapshot(),
      value: JSON.stringify({
        intentId: 'intent-1',
        owner,
        renderedRevision: 7,
        intent: { kind: 'action', commandId: 'home.send', itemId: 'send' },
      }),
    });
    expect(result).toMatchObject({
      accepted: false,
      reason: 'revisionMismatch',
    });
  });

  it('rejects commands missing from the current registry', () => {
    const result = guardHomeNativeIntent({
      currentOwner: owner,
      currentRevision: 8,
      currentSnapshot: buildSnapshot(),
      value: JSON.stringify({
        intentId: 'intent-2',
        owner,
        renderedRevision: 8,
        intent: { kind: 'action', commandId: 'home.removed' },
      }),
    });
    expect(result).toMatchObject({
      accepted: false,
      reason: 'commandUnavailable',
    });
  });

  it('rejects malformed discriminated intent payloads', () => {
    const result = guardHomeNativeIntent({
      currentOwner: owner,
      currentRevision: 8,
      currentSnapshot: buildSnapshot(),
      value: JSON.stringify({
        intentId: 'intent-3',
        owner,
        renderedRevision: 8,
        intent: { kind: 'action' },
      }),
    });
    expect(result).toEqual({ accepted: false, reason: 'invalidIntent' });
  });

  it('returns a parsed rejected refresh so native refresh can be completed', () => {
    const result = guardHomeNativeIntent({
      currentOwner: owner,
      currentRevision: 8,
      currentSnapshot: buildSnapshot(),
      value: JSON.stringify({
        intentId: 'intent-refresh',
        owner: { ...owner, sessionId: 'stale-session' },
        renderedRevision: 8,
        intent: {
          kind: 'refresh',
          tabId: 'portfolio',
          requestId: 'refresh-1',
        },
      }),
    });
    expect(result).toMatchObject({
      accepted: false,
      reason: 'ownerMismatch',
      intent: {
        intent: { kind: 'refresh', requestId: 'refresh-1' },
      },
    });
  });

  it('rejects stale select and refresh intents against the rendered revision', () => {
    const guard = (kind: 'refresh' | 'selectTab') =>
      guardHomeNativeIntent({
        currentOwner: owner,
        currentRevision: 8,
        currentSnapshot: buildSnapshot(),
        value: JSON.stringify({
          intentId: `stale-${kind}`,
          owner,
          renderedRevision: 7,
          intent:
            kind === 'refresh'
              ? { kind, tabId: 'portfolio', requestId: 'stale-refresh' }
              : { kind, tabId: 'portfolio' },
        }),
      });

    expect(guard('selectTab')).toMatchObject({
      accepted: false,
      reason: 'revisionMismatch',
    });
    expect(guard('refresh')).toMatchObject({
      accepted: false,
      reason: 'revisionMismatch',
      intent: { intent: { requestId: 'stale-refresh' } },
    });
  });

  it('accepts only the current command registered by a handoff tab', () => {
    const snapshot = buildSnapshot();
    const handoffSnapshot: IHomeContainerSnapshot = {
      ...snapshot,
      tabs: [
        ...snapshot.tabs,
        {
          id: 'perps',
          title: 'Perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        },
      ],
    };
    const buildValue = (commandId: string, renderedRevision = 8) =>
      JSON.stringify({
        intentId: 'intent-handoff',
        owner,
        renderedRevision,
        intent: { kind: 'handoff', tabId: 'perps', commandId },
      });

    expect(
      guardHomeNativeIntent({
        currentOwner: owner,
        currentRevision: 8,
        currentSnapshot: handoffSnapshot,
        value: buildValue('home.perps.openWeb'),
      }),
    ).toMatchObject({ accepted: true });
    expect(
      guardHomeNativeIntent({
        currentOwner: owner,
        currentRevision: 8,
        currentSnapshot: handoffSnapshot,
        value: buildValue('home.perps.removed'),
      }),
    ).toMatchObject({ accepted: false, reason: 'commandUnavailable' });
    expect(
      guardHomeNativeIntent({
        currentOwner: owner,
        currentRevision: 8,
        currentSnapshot: handoffSnapshot,
        value: buildValue('home.perps.openWeb', 7),
      }),
    ).toMatchObject({ accepted: false, reason: 'revisionMismatch' });
  });

  it('does not accept handoff tabs as inline selection or refresh targets', () => {
    const snapshot = buildSnapshot();
    const currentSnapshot: IHomeContainerSnapshot = {
      ...snapshot,
      tabs: [
        ...snapshot.tabs,
        {
          id: 'perps',
          title: 'Perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        },
      ],
    };
    const guard = (kind: 'refresh' | 'selectTab') =>
      guardHomeNativeIntent({
        currentOwner: owner,
        currentRevision: 8,
        currentSnapshot,
        value: JSON.stringify({
          intentId: `intent-${kind}`,
          owner,
          renderedRevision: 8,
          intent:
            kind === 'refresh'
              ? { kind, tabId: 'perps', requestId: 'refresh-perps' }
              : { kind, tabId: 'perps' },
        }),
      });

    expect(guard('refresh')).toMatchObject({
      accepted: false,
      reason: 'tabUnavailable',
    });
    expect(guard('selectTab')).toMatchObject({
      accepted: false,
      reason: 'tabUnavailable',
    });
  });

  it('routes the protocol v1 Perps handoff only for the current web destination', () => {
    const snapshot = buildSnapshot();
    const currentSnapshot: IHomeContainerSnapshot = {
      ...snapshot,
      tabs: [
        ...snapshot.tabs,
        {
          id: 'perps',
          title: 'Perps',
          destination: 'handoff',
          handoffCommandId: 'home.perps.openWeb',
          sections: [],
        },
      ],
    };
    const currentNavigation = {
      kind: 'ready' as const,
      destinations: { perps: 'web' as const, portfolio: 'inline' as const },
      freshness: 'live' as const,
      perpsDestination: 'web' as const,
      refresh: 'idle' as const,
      sections: {
        defi: false,
        history: true,
        market: true,
        nft: false,
        perps: true,
        portfolio: true,
      },
      selectedTabId: 'portfolio' as const,
      tabs: ['portfolio', 'perps', 'history'] as const,
    };
    const canHandoff = (input: {
      commandId?: string;
      snapshot?: IHomeContainerSnapshot;
      tabId?: string;
    }) =>
      isHomeNativeLegacyHandoffAvailable({
        commandId: input.commandId ?? 'home.perps.openWeb',
        currentNavigation,
        currentSnapshot: input.snapshot ?? currentSnapshot,
        tabId: input.tabId ?? 'perps',
      });

    expect(canHandoff({})).toBe(true);
    expect(canHandoff({ commandId: 'home.perps.removed' })).toBe(false);
    expect(canHandoff({ tabId: 'portfolio' })).toBe(false);
    expect(canHandoff({ snapshot })).toBe(false);
    expect(
      isHomeNativeLegacyHandoffAvailable({
        commandId: 'home.perps.openWeb',
        currentNavigation: {
          ...currentNavigation,
          destinations: { perps: 'inline', portfolio: 'inline' },
          perpsDestination: 'inline',
        },
        currentSnapshot,
        tabId: 'perps',
      }),
    ).toBe(false);

    const onOpenPerpsWeb = jest.fn();
    expect(
      handleHomeNativeLegacyHandoff({
        commandId: 'home.perps.openWeb',
        currentNavigation,
        currentSnapshot,
        onOpenPerpsWeb,
        tabId: 'perps',
      }),
    ).toBe(true);
    expect(onOpenPerpsWeb).toHaveBeenCalledTimes(1);
    expect(
      handleHomeNativeLegacyHandoff({
        commandId: 'home.perps.openWeb',
        currentNavigation: {
          ...currentNavigation,
          destinations: { perps: 'inline', portfolio: 'inline' },
          perpsDestination: 'inline',
        },
        currentSnapshot,
        onOpenPerpsWeb,
        tabId: 'perps',
      }),
    ).toBe(false);
    expect(onOpenPerpsWeb).toHaveBeenCalledTimes(1);
  });

  it('mounts a slot bundle only for the rendered owner and revision', () => {
    const bundle = createHomeNativeSlotBundle({
      owner,
      semanticRevision: 8,
      slotContractRevision: 1,
      slots: {},
    });
    expect(
      isHomeNativeSlotBundleCurrent({ bundle, owner, renderedRevision: 8 }),
    ).toBe(true);
    expect(
      isHomeNativeSlotBundleCurrent({
        bundle,
        owner: { ...owner, sessionId: 'session-2' },
        renderedRevision: 8,
      }),
    ).toBe(false);
    expect(
      isHomeNativeSlotBundleCurrent({ bundle, owner, renderedRevision: 9 }),
    ).toBe(false);
    expect(
      isHomeNativeSlotBundleCurrent({
        bundle: { ...bundle, slotContractRevision: 2 },
        owner,
        renderedRevision: 8,
      }),
    ).toBe(false);
  });

  it('queues slots after committed business effects instead of during render', () => {
    const hookSource = fs.readFileSync(
      path.join(__dirname, '../../useNativeHomeContainerScopeController.ts'),
      'utf8',
    );
    const pageSource = fs.readFileSync(
      path.join(__dirname, '../../NativeHomePage.native.tsx'),
      'utf8',
    );
    const lastBusinessUpdate = hookSource.lastIndexOf(
      "controller.updateTabSections('history'",
    );
    const slotUpdate = hookSource.indexOf('controller.updateSlots(slots)');

    expect(lastBusinessUpdate).toBeGreaterThan(-1);
    expect(slotUpdate).toBeGreaterThan(lastBusinessUpdate);
    expect(pageSource).not.toContain('controller.updateSlots(homeSlots)');
  });

  it('does not switch an existing controller owner during render acquisition', () => {
    const controllerOwner: INativeHomeContainerControllerOwner = {};
    const controller = acquireNativeHomeContainerController({
      owner: controllerOwner,
      scopeKey: 'scope-a',
      snapshot: buildSnapshot(),
    });
    const acquiredDuringRender = acquireNativeHomeContainerController({
      owner: controllerOwner,
      scopeKey: 'scope-b',
      snapshot: {
        ...buildSnapshot(),
        header: { ...buildSnapshot().header, accountName: 'B' },
      },
      deferScopeCommit: true,
    });

    expect(acquiredDuringRender).toBe(controller);
    expect(controllerOwner.scopeKey).toBe('scope-a');
    expect(controller.getOwner().scopeKey).toBe('scope-a');
  });
});
