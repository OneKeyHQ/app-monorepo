import {
  HOME_BANNER_ACTION_IDS,
  readHomeBannerStorePayload,
  toHomeBannerStoreItem,
} from '../../sections/banner/homeBannerStoreModel';
import { createInitialHomeStoreState } from '../homeStoreInitialState';
import {
  applyHomeStorePatchToState,
  reduceHomeStore,
} from '../homeStoreReducer';

import type {
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreState,
} from '../homeStoreTypes';

const owner = {
  walletId: 'wallet-a',
  accountId: 'account-a',
  network: { kind: 'singleNetwork' as const, networkId: 'network-a' },
};
const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };

function dispatch(state: IHomeStoreState, event: IHomeStoreEvent) {
  const transition = reduceHomeStore(state, event);
  return {
    state: applyHomeStorePatchToState(state, transition.patch.mutations),
    effects: transition.effects,
  };
}

function createBannerState(): IHomeStoreState {
  const owned = dispatch(createInitialHomeStoreState(), {
    type: 'ownerChanged',
    owner,
    ownerToken,
    topology: 'split',
  }).state;
  return {
    ...owned,
    resources: {
      ...owned.resources,
      banner: {
        kind: 'ready',
        data: {
          banners: [
            toHomeBannerStoreItem({
              _id: 'banner-a',
              id: 'banner-a',
              src: '',
              title: 'Banner A',
              description: '',
              button: '',
              rank: 1,
              closeable: true,
              closeForever: true,
              useSystemBrowser: false,
              theme: 'light',
            }),
          ],
          referralEligibility: null,
          tronResource: null,
          isBotWalletReceiveBlocked: false,
        },
        coverageFingerprint: 'banner-a',
        freshness: 'live',
        refresh: 'idle',
      },
    },
    shell: {
      presentationRevision: 1,
      shellCommandRevision: 1,
      value: {
        kind: 'portfolio',
        presentation: {
          kind: 'funded',
          header: {
            kind: 'funded',
            balance: { amount: '1', currency: 'usd' },
            authority: 'live',
          },
          actions: { kind: 'funded', items: ['send', 'receive'] },
          banner: { kind: 'positive' },
        },
      },
    },
  };
}

function bannerIntent({
  actionId,
  execution,
  intentId,
}: {
  actionId: string;
  execution: 'caller' | 'controller';
  intentId: string;
}): IHomeStoreIntent {
  return {
    type: 'headerActionInvoked',
    actionId,
    authority: { kind: 'shellCommands', revision: 1 },
    execution,
    intentId,
    itemId: 'banner-a',
    owner,
    sessionId: ownerToken.sessionId,
  };
}

describe('Home Store banner command authority', () => {
  it('normalizes optional runtime fields before strict Store validation', () => {
    const item = toHomeBannerStoreItem({
      _id: 'banner-a',
      id: 'banner-a',
      src: '',
      title: 'Banner A',
      rank: 1,
      closeable: true,
      closeForever: false,
      useSystemBrowser: false,
    } as unknown as Parameters<typeof toHomeBannerStoreItem>[0]);

    expect(item).toEqual(
      expect.objectContaining({
        button: '',
        description: '',
        theme: 'light',
      }),
    );
    expect(
      readHomeBannerStorePayload({
        banners: [item],
        referralEligibility: null,
        tronResource: null,
        isBotWalletReceiveBlocked: false,
      }),
    ).toBeDefined();
  });

  it('executes a caller-owned open only after Store validation', () => {
    const state = createBannerState();
    const accepted = dispatch(state, {
      type: 'intentReceived',
      intent: bannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.open,
        execution: 'caller',
        intentId: 'open-a',
      }),
    });

    expect(accepted.effects).toEqual([
      expect.objectContaining({
        kind: 'executeCommand',
        intent: expect.objectContaining({ intentId: 'open-a' }),
      }),
    ]);
    const hiddenShell = {
      ...state,
      shell: {
        ...state.shell,
        value: { kind: 'loading' as const },
      },
    };
    const rejected = dispatch(hiddenShell, {
      type: 'intentReceived',
      intent: bannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.open,
        execution: 'caller',
        intentId: 'open-hidden',
      }),
    });
    expect(rejected.effects).toEqual([
      expect.objectContaining({
        kind: 'traceReject',
        reason: 'intentTargetUnavailable',
      }),
    ]);
  });

  it('executes a valid command from a cached Banner', () => {
    const liveState = createBannerState();
    const banner = liveState.resources.banner;
    expect(banner.kind).toBe('ready');
    if (banner.kind !== 'ready') {
      return;
    }
    const state: IHomeStoreState = {
      ...liveState,
      resources: {
        ...liveState.resources,
        banner: {
          ...banner,
          freshness: 'confirmedCache',
        },
      },
    };

    const accepted = dispatch(state, {
      type: 'intentReceived',
      intent: bannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.open,
        execution: 'caller',
        intentId: 'open-cached-banner',
      }),
    });

    expect(accepted.effects).toEqual([
      {
        kind: 'executeCommand',
        intent: expect.objectContaining({ intentId: 'open-cached-banner' }),
      },
    ]);
  });

  it('queues, coalesces, and owner-validates controller-owned dismissals', () => {
    const state = createBannerState();
    const first = dispatch(state, {
      type: 'intentReceived',
      intent: bannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.dismiss,
        execution: 'controller',
        intentId: 'dismiss-a',
      }),
    }).state;
    const duplicate = dispatch(first, {
      type: 'intentReceived',
      intent: bannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.dismiss,
        execution: 'controller',
        intentId: 'dismiss-b',
      }),
    }).state;

    expect(duplicate.interaction.pendingShellCommands).toHaveLength(1);
    expect(duplicate.interaction.acceptedIntentIds).toContain('dismiss-b');
    expect(duplicate.interaction.dismissedBannerIds).toEqual(['banner-a']);
    const wrongOwner = dispatch(duplicate, {
      type: 'commandHandled',
      intentId: 'dismiss-a',
      ownerToken: { ...ownerToken, scopeKey: 'owner-b' },
    }).state;
    expect(wrongOwner.interaction.pendingShellCommands).toHaveLength(1);
    const handled = dispatch(duplicate, {
      type: 'commandHandled',
      intentId: 'dismiss-a',
      ownerToken,
    }).state;
    expect(handled.interaction.pendingShellCommands).toEqual([]);
    expect(handled.resources).toBe(duplicate.resources);
  });
});
