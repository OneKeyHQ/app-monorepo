import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { buildHomeBannerSemanticFingerprint } from '../sections/banner/homeBannerStoreModel';

import { HomeSourceRuntime } from './homeSourceRuntime';

import type { IHomeStoreEvent, IHomeStoreState } from '../store/homeStoreTypes';

type IHomeBannerStorePayload = Parameters<
  typeof buildHomeBannerSemanticFingerprint
>[0];

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      isBotWalletDeactivated: jest.fn(),
    },
    serviceAllNetwork: {
      clearGetAllNetworkAccountsCache: jest.fn(),
      getAllNetworkAccounts: jest.fn(),
    },
    serviceHyperliquidReferral: {
      checkBannerReferralEligibility: jest.fn(),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(),
    },
    serviceWalletBanner: {
      fetchWalletBanner: jest.fn(),
      updateLocalTopBanners: jest.fn(),
    },
    simpleDb: {
      walletBanner: {
        getRawData: jest.fn(),
      },
    },
  },
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('HomeSourceRuntime banner workflow', () => {
  it('publishes a normal banner before optional referral settles', async () => {
    const remote =
      createDeferred<
        Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceWalletBanner.fetchWalletBanner
          >
        >
      >();
    const referral = createDeferred<{
      reason?: string;
      resolvedAccountId: string;
      resolvedAddress: string;
      shouldShow: boolean;
    }>();
    /* eslint-disable @typescript-eslint/unbound-method */
    const fetchWalletBanner = jest.mocked(
      backgroundApiProxy.serviceWalletBanner.fetchWalletBanner,
    );
    fetchWalletBanner.mockReturnValue(remote.promise);
    const getRawBannerData = jest.mocked(
      backgroundApiProxy.simpleDb.walletBanner.getRawData,
    );
    getRawBannerData.mockResolvedValue({
      closedForever: {},
      topBanners: [
        {
          _id: 'local-banner',
          id: 'local-banner',
          src: '',
          title: 'Local',
          description: '',
          button: '',
          rank: 0,
          closeable: false,
          closeForever: false,
          useSystemBrowser: false,
          theme: 'light',
          position: 'home',
        },
      ],
    });
    const getGlobalDeriveType = jest.mocked(
      backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork,
    );
    getGlobalDeriveType.mockResolvedValue('default');
    const checkReferralEligibility = jest.mocked(
      backgroundApiProxy.serviceHyperliquidReferral
        .checkBannerReferralEligibility,
    );
    checkReferralEligibility.mockReturnValue(referral.promise);
    /* eslint-enable @typescript-eslint/unbound-method */

    const priorities: string[] = [];
    const state = {
      interaction: { dismissedBannerIds: [] },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: (
          priority: string,
          request: () => Promise<unknown>,
          _sessionId?: string,
        ) => {
          priorities.push(priority);
          return request();
        },
      } as never,
      dispatch: jest.fn(),
      dispatchAtomically: jest.fn(),
      getStateView: () => state,
    });
    const publishIntermediate = jest.fn<void, [IHomeBannerStorePayload]>();
    const loadBanner = (
      runtime as unknown as {
        loadBanner(
          environment: unknown,
          priority: 'critical',
          sessionId: string,
          publish: (payload: IHomeBannerStorePayload) => void,
        ): Promise<IHomeBannerStorePayload>;
      }
    ).loadBanner.bind(runtime);

    const result = loadBanner(
      {
        activeAccount: {
          account: { id: 'account-a' },
          indexedAccount: { id: 'indexed-a' },
          network: { id: 'network-a' },
          vaultSettings: { hasResource: false },
          wallet: { id: 'hd-wallet-a' },
        },
        bannerLabels: {
          referralDescription: 'Referral description',
          referralTitle: 'Referral',
        },
      },
      'critical',
      'session-a',
      publishIntermediate,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(publishIntermediate).toHaveBeenCalledWith(
      expect.objectContaining({
        banners: [expect.objectContaining({ id: 'local-banner' })],
      }),
    );
    expect(priorities).toContain('background');

    remote.resolve([]);
    referral.resolve({
      reason: undefined,
      resolvedAccountId: 'account-a',
      resolvedAddress: '0x1',
      shouldShow: false,
    });
    await expect(result).resolves.toMatchObject({
      banners: [],
      referralEligibility: {
        shouldShow: false,
      },
    });
    runtime.dispose();
  });

  it('does not commit a final banner that matches the live intermediate', () => {
    const payload: IHomeBannerStorePayload = {
      banners: [],
      referralEligibility: null,
      tronResource: {
        accountId: 'account-a',
        networkId: 'network-a',
      },
      isBotWalletReceiveBlocked: false,
    };
    const dispatch = jest.fn();
    const dispatchAtomically = jest.fn();
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        banner: {
          kind: 'ready',
          data: payload,
          coverageFingerprint: buildHomeBannerSemanticFingerprint(payload),
          freshness: 'live',
          refresh: 'idle',
        },
      },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch,
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: Record<string, never>;
          phase: 'final';
          sourceId: 'banner';
          wire: IHomeBannerStorePayload;
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: {},
      phase: 'final',
      sourceId: 'banner',
      wire: payload,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(dispatchAtomically).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it('does not let a lower-quality intermediate replace visible section data', () => {
    const dispatch = jest.fn();
    const dispatchAtomically = jest.fn();
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        portfolio: {
          kind: 'ready',
          coverageFingerprint: 'prepared-account-3',
          data: {
            payload: {
              accountTokensValue: '6.69',
              accountTokensValueComplete: true,
              displayIds: ['eth'],
              fundedIds: ['eth'],
            },
          },
          freshness: 'confirmedCache',
          refresh: 'refreshing',
        },
      },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch,
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: Record<string, never>;
          phase: 'intermediate';
          sourceId: 'portfolio';
          wire: {
            empty: boolean;
            error: boolean;
            payload: null;
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: {},
      phase: 'intermediate',
      sourceId: 'portfolio',
      wire: {
        empty: true,
        error: false,
        payload: null,
        rowIds: [],
      },
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(dispatchAtomically).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it('marks first-content intermediate data as refreshing instead of final', () => {
    const dispatchAtomically = jest.fn();
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        portfolio: { kind: 'loading' },
      },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch: jest.fn(),
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: Record<string, never>;
          phase: 'intermediate';
          sourceId: 'portfolio';
          wire: {
            empty: boolean;
            error: boolean;
            payload: { displayIds: string[] };
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: {},
      phase: 'intermediate',
      sourceId: 'portfolio',
      wire: {
        empty: false,
        error: false,
        payload: { displayIds: ['eth'] },
        rowIds: ['eth'],
      },
    });

    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        result: expect.objectContaining({
          kind: 'ready',
          refresh: 'refreshing',
        }),
        sectionId: 'portfolio',
        type: 'sectionSourceChanged',
      }),
    ]);
    runtime.dispose();
  });

  it('does not turn an unavailable aggregate into a complete zero fact', () => {
    const owner = {
      walletId: 'wallet-a',
      accountId: 'account-a',
      network: { kind: 'allNetworks' as const },
    };
    const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-a' };
    const facts = {
      owner,
      ownerToken,
      wallet: {
        ready: true,
        hasNetworkAccount: true,
        backupStatus: 'complete',
        accountType: 'hd',
      },
      environment: { theme: 'light' },
      runtime: {
        topology: 'split',
        connection: 'ready',
        protocolVersion: 1,
      },
      capabilityInputs: {
        ready: false,
        networkFamily: 'allNetworks',
        accountType: 'hd',
        allNetworks: true,
        serverConfig: {
          perps: false,
          defi: false,
          nft: false,
          history: false,
          market: false,
        },
        productAvailability: {
          perps: false,
          defi: false,
          nft: false,
          history: false,
          market: false,
        },
      },
      sources: createIdleHomeSourceFacts(),
      confirmed: {},
    };
    const state = {
      facts,
      session: {
        ownerToken,
        surfaceVisibility: 'hidden',
      },
      resources: {
        banner: { kind: 'idle' },
        portfolio: { kind: 'loading' },
        defi: { kind: 'idle' },
        perps: { kind: 'idle' },
      },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch: jest.fn(),
      dispatchAtomically: jest.fn(),
      getStateView: () => state,
    });
    runtime.updateEnvironment({
      activeAccount: { ready: true },
      bannerLabels: {
        referralDescription: '',
        referralTitle: '',
      },
      currencyMap: {},
      settings: {
        currencyInfo: { id: 'usd' },
        isFilterLowValueHistoryEnabled: false,
        isFilterScamHistoryEnabled: false,
        locale: 'en-US',
      },
    } as Parameters<HomeSourceRuntime['updateEnvironment']>[0]);
    const createBalanceEvent = (
      runtime as unknown as {
        createBalanceEvent(override: {
          sourceId: 'portfolio';
          payload: {
            accountTokensValue: string;
            accountTokensValueAvailable?: boolean;
            accountTokensValueComplete?: boolean;
            displayIds: string[];
            fundedIds: string[];
          };
          rowIds: string[];
          empty: boolean;
          phase: 'final';
        }): IHomeStoreEvent | undefined;
      }
    ).createBalanceEvent.bind(runtime);

    const event = createBalanceEvent({
      sourceId: 'portfolio',
      payload: {
        accountTokensValue: '0',
        accountTokensValueAvailable: false,
        accountTokensValueComplete: false,
        displayIds: [],
        fundedIds: [],
      },
      rowIds: [],
      empty: true,
      phase: 'final',
    });

    expect(event).toMatchObject({
      type: 'balanceChanged',
      facts: {
        balance: {
          contributors: {
            portfolio: {
              resource: { kind: 'loading' },
            },
          },
        },
      },
    });

    const missingQualityEvent = createBalanceEvent({
      sourceId: 'portfolio',
      payload: {
        accountTokensValue: '0',
        displayIds: [],
        fundedIds: [],
      },
      rowIds: [],
      empty: true,
      phase: 'final',
    });
    expect(missingQualityEvent).toMatchObject({
      type: 'balanceChanged',
      facts: {
        balance: {
          contributors: {
            portfolio: {
              resource: { kind: 'loading' },
            },
          },
        },
      },
    });

    const partialEvent = createBalanceEvent({
      sourceId: 'portfolio',
      payload: {
        accountTokensValue: '6.69',
        accountTokensValueAvailable: true,
        accountTokensValueComplete: false,
        displayIds: ['eth'],
        fundedIds: ['eth'],
      },
      rowIds: ['eth'],
      empty: false,
      phase: 'final',
    });
    expect(partialEvent).toMatchObject({
      type: 'balanceChanged',
      facts: {
        balance: {
          contributors: {
            portfolio: {
              resource: {
                kind: 'partial',
                data: {
                  amount: '6.69',
                  positiveEvidence: true,
                },
              },
            },
          },
        },
      },
    });
    runtime.dispose();
  });

  it('releases an expired memory snapshot as stale-visible before revalidation', () => {
    const dispatch = jest.fn();
    const dispatchAtomically = jest.fn();
    const ownerToken = { scopeKey: 'owner-a', sessionId: 'session-new' };
    const state = {
      session: { ownerToken },
      resources: { portfolio: { kind: 'idle' } },
    } as unknown as IHomeStoreState;
    const runtime = new HomeSourceRuntime({
      identity: {
        runtimeInstanceId: 'runtime-a',
        clientInstanceId: 'client-a',
      },
      scheduler: {} as never,
      commitBudget: {} as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch,
      dispatchAtomically,
      getStateView: () => state,
    });
    const privateRuntime = runtime as unknown as {
      hydrateCache(
        sourceId: 'portfolio',
        sourceKey: string,
        authority: {
          ownerScopeKey: string;
          sessionId: string;
        },
        sink: { flushBuffered(): undefined },
      ): void;
      rememberCache(
        sourceId: 'portfolio',
        sourceKey: string,
        entry: {
          coverageFingerprint: string;
          dataRevision: number;
          expiresAt: number;
          phase: 'final' | 'intermediate';
          payload: {
            empty: boolean;
            error: boolean;
            payload: { accountTokensValue: string };
            rowIds: string[];
          };
          rowIds: string[];
        },
      ): void;
    };
    privateRuntime.rememberCache('portfolio', 'portfolio-a', {
      coverageFingerprint: 'portfolio-a',
      dataRevision: 1,
      expiresAt: 1,
      phase: 'final',
      payload: {
        empty: false,
        error: false,
        payload: { accountTokensValue: '6.69' },
        rowIds: ['eth'],
      },
      rowIds: ['eth'],
    });

    privateRuntime.hydrateCache(
      'portfolio',
      'portfolio-a',
      {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
      },
      { flushBuffered: () => undefined },
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(dispatchAtomically).toHaveBeenCalledWith([
      {
        type: 'sectionSourceChanged',
        ownerToken,
        sectionId: 'portfolio',
        result: expect.objectContaining({
          kind: 'ready',
          freshness: 'confirmedCache',
          refresh: 'refreshing',
          rowIds: ['eth'],
        }),
      },
    ]);
    runtime.dispose();
  });
});
