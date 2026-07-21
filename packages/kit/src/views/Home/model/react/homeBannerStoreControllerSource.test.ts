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

    expect(payload.banners.map((banner) => banner.id)).toEqual(['local-a']);
    expect(complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'success', data: payload }),
    );
  });
});
