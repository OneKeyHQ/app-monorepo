import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import { runHomeBannerStoreRequest } from './homeBannerStoreControllerSource';

import type { IHomeBannerSourceGateway } from './homeBannerStoreControllerSource';

const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };

describe('Home banner Store source', () => {
  it('opens the Store request before every source call and completes the same handle', async () => {
    const order: string[] = [];
    const handle = {
      request: { ownerToken, sourceId: 'banner' as const },
      token: { requestSeq: 1 },
    } as unknown as ReturnType<IHomeBannerSourceGateway['begin']>;
    const gateway: IHomeBannerSourceGateway = {
      begin: () => {
        order.push('requested');
        return handle;
      },
      complete: (receivedHandle) => {
        expect(receivedHandle).toBe(handle);
        order.push('completed');
      },
    };
    const sourceCall = (name: string) => {
      order.push(name);
      return Promise.resolve();
    };

    const payload = await runHomeBannerStoreRequest({
      api: {
        readLocal: async () => {
          await sourceCall('local');
          return null;
        },
        fetchRemote: async () => {
          await sourceCall('remote');
          return [];
        },
        fetchReferralEligibility: async () => {
          await sourceCall('eligibility');
          return {
            shouldShow: false,
            resolvedAccountId: '',
            resolvedAddress: '',
            reason: null,
          };
        },
        fetchBotWalletDeactivated: async () => {
          await sourceCall('bot-status');
          return false;
        },
        updateLocalTopBanners: async () => {
          await sourceCall('cache-write');
        },
      },
      createReferralBanner: () => null,
      gateway,
      hasBotWallet: true,
      networkId: 'network-a',
      ownerToken,
      paramsFingerprint: 'owner-a-banner',
      sessionDismissedIds: [],
      tronResource: null,
    });

    expect(order[0]).toBe('requested');
    expect(order.at(-1)).toBe('completed');
    expect(payload).toEqual({
      banners: [],
      referralEligibility: {
        shouldShow: false,
        resolvedAccountId: '',
        resolvedAddress: '',
        reason: null,
      },
      tronResource: null,
      isBotWalletReceiveBlocked: false,
    });
  });

  it('keeps eligible local fallback data when the remote request fails', async () => {
    const complete = jest.fn();
    const localBanner = {
      _id: 'local-a',
      id: 'local-a',
      src: '',
      title: 'Local',
      description: '',
      button: '',
      rank: 1,
      closeable: true,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light' as const,
      position: 'home' as const,
    };
    const gateway = {
      begin: jest.fn(() => ({
        request: { ownerToken, sourceId: 'banner' as const },
        token: { requestSeq: 1 },
      })),
      complete,
    } as unknown as IHomeBannerSourceGateway;

    const payload = await runHomeBannerStoreRequest({
      api: {
        readLocal: async () => ({ topBanners: [localBanner] }),
        fetchRemote: async () => Promise.reject(new Error('offline')),
        fetchReferralEligibility: async () =>
          Promise.reject(new Error('offline')),
        fetchBotWalletDeactivated: async () => false,
        updateLocalTopBanners: async () => undefined,
      },
      createReferralBanner: () => null,
      gateway,
      hasBotWallet: false,
      networkId: 'network-a',
      ownerToken,
      paramsFingerprint: 'owner-a-banner',
      sessionDismissedIds: [],
      tronResource: null,
    });

    expect(payload).toBeDefined();
    expect(payload?.banners.map((banner) => banner.id)).toEqual(['local-a']);
    expect(complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'success',
        data: payload,
        coverageFingerprint: buildHomeBannerCoverageFingerprint({
          bannerIds: ['local-a'],
          hasTronResource: false,
        }),
      }),
    );
  });

  it('publishes the local banner snapshot before the remote refresh settles', async () => {
    const complete = jest.fn();
    const localBanner = {
      _id: 'local-a',
      id: 'local-a',
      src: '',
      title: 'Local',
      description: '',
      button: '',
      rank: 1,
      closeable: true,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light' as const,
      position: 'home' as const,
    };
    let resolveRemote!: (banners: (typeof localBanner)[]) => void;
    let markRemoteStarted!: () => void;
    const remoteResult = new Promise<(typeof localBanner)[]>((resolve) => {
      resolveRemote = resolve;
    });
    const remoteStarted = new Promise<void>((resolve) => {
      markRemoteStarted = resolve;
    });
    const gateway = {
      begin: jest.fn(() => ({
        request: { ownerToken, sourceId: 'banner' as const },
        token: { requestSeq: 1 },
      })),
      complete,
    } as unknown as IHomeBannerSourceGateway;

    const request = runHomeBannerStoreRequest({
      api: {
        readLocal: async () => ({ topBanners: [localBanner] }),
        fetchRemote: () => {
          markRemoteStarted();
          return remoteResult;
        },
        fetchReferralEligibility: async () => ({
          shouldShow: false,
          resolvedAccountId: '',
          resolvedAddress: '',
          reason: null,
        }),
        fetchBotWalletDeactivated: async () => false,
        updateLocalTopBanners: async () => undefined,
      },
      createReferralBanner: () => null,
      gateway,
      hasBotWallet: false,
      networkId: 'network-a',
      ownerToken,
      paramsFingerprint: 'owner-a-banner',
      sessionDismissedIds: [],
      tronResource: null,
    });

    await remoteStarted;
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'partial',
        data: expect.objectContaining({
          banners: [expect.objectContaining({ id: 'local-a' })],
        }),
      }),
    );

    resolveRemote([]);
    await request;
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'success' }),
    );
  });

  it('filters the current payload without replacing the shared cache with a network subset', async () => {
    const networkABanner = {
      _id: 'network-a',
      id: 'network-a',
      src: '',
      title: 'Network A',
      description: '',
      button: '',
      rank: 1,
      closeable: true,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light' as const,
      position: 'home' as const,
      networkIds: ['network-a'],
    };
    const networkBBanner = {
      ...networkABanner,
      _id: 'network-b',
      id: 'network-b',
      title: 'Network B',
      networkIds: ['network-b'],
    };
    const remoteBanners = [networkABanner, networkBBanner];
    const updateLocalTopBanners = jest.fn(async () => undefined);
    const gateway = {
      begin: jest.fn(() => ({
        request: { ownerToken, sourceId: 'banner' as const },
        token: { requestSeq: 1 },
      })),
      complete: jest.fn(),
    } as unknown as IHomeBannerSourceGateway;

    const payload = await runHomeBannerStoreRequest({
      api: {
        readLocal: async () => null,
        fetchRemote: async () => remoteBanners,
        fetchReferralEligibility: async () =>
          Promise.reject(new Error('offline')),
        fetchBotWalletDeactivated: async () => false,
        updateLocalTopBanners,
      },
      createReferralBanner: () => null,
      gateway,
      hasBotWallet: false,
      networkId: 'network-a',
      ownerToken,
      paramsFingerprint: 'owner-a-banner',
      sessionDismissedIds: [],
      tronResource: null,
    });

    expect(payload).toBeDefined();
    expect(payload?.banners.map((banner) => banner.id)).toEqual(['network-a']);
    expect(updateLocalTopBanners).toHaveBeenCalledWith(remoteBanners);
  });

  it('preserves the current Store banner when local and remote sources both fail', async () => {
    const complete = jest.fn();
    const gateway = {
      begin: jest.fn(() => ({
        request: { ownerToken, sourceId: 'banner' as const },
        token: { requestSeq: 1 },
      })),
      complete,
    } as unknown as IHomeBannerSourceGateway;

    const payload = await runHomeBannerStoreRequest({
      api: {
        readLocal: async () => Promise.reject(new Error('local unavailable')),
        fetchRemote: async () =>
          Promise.reject(new Error('remote unavailable')),
        fetchReferralEligibility: async () =>
          Promise.reject(new Error('referral unavailable')),
        fetchBotWalletDeactivated: async () => false,
        updateLocalTopBanners: async () => undefined,
      },
      createReferralBanner: () => null,
      gateway,
      hasBotWallet: false,
      networkId: 'network-a',
      ownerToken,
      paramsFingerprint: 'owner-a-banner',
      sessionDismissedIds: [],
      tronResource: null,
    });

    expect(payload).toBeUndefined();
    expect(complete).toHaveBeenCalledWith(expect.anything(), {
      kind: 'error',
      errorKind: 'source',
    });
  });
});
