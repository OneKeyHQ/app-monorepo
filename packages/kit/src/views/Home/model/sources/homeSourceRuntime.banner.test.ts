import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { buildHomeBannerSemanticFingerprint } from '../sections/banner/homeBannerStoreModel';
import { createHomeSpotSnapshotDefaults } from '../sections/spot/homeSpotSourceAdapter';

import { HomeSourceRuntime } from './homeSourceRuntime';

import type { IHomeResultAuthority } from '../results/homeResultSink';
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

function createToken(key: string, symbol: string): IAccountToken {
  return {
    $key: key,
    address: key,
    decimals: 18,
    isNative: false,
    name: symbol,
    symbol,
  };
}

function createFiat(fiatValue: string): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue,
    price: Number(fiatValue),
  };
}

function createAuthority(
  sourceId: IHomeResultAuthority['sourceId'],
): IHomeResultAuthority {
  return {
    ownerScopeKey: 'owner-a',
    runtimeInstanceId: 'runtime-a',
    appEpoch: 'app-a',
    clientInstanceId: 'client-a',
    sessionId: 'session-a',
    producerInstanceId: 'producer-a',
    sourceId,
    sourceKey: `${sourceId}-key`,
    requestSequence: 1,
    sourceRevision: 1,
    requestGroupId: `session-a:${sourceId}`,
    taskId: `task:${sourceId}`,
  };
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

  it('preserves visible Portfolio data when a final empty is unconfirmed', () => {
    const dispatchAtomically = jest.fn();
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        portfolio: {
          kind: 'ready',
          coverageFingerprint: '1:eth:eth',
          data: {
            payload: {
              accountTokensValue: '1',
              accountTokensValueComplete: true,
              displayIds: ['eth'],
              fundedIds: ['eth'],
            },
          },
          freshness: 'live',
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
      dispatch: jest.fn(),
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: IHomeResultAuthority;
          phase: 'final';
          sourceId: 'portfolio';
          wire: {
            confirmedEmpty: boolean;
            empty: boolean;
            error: boolean;
            payload: null;
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: createAuthority('portfolio'),
      phase: 'final',
      sourceId: 'portfolio',
      wire: {
        confirmedEmpty: false,
        empty: true,
        error: false,
        payload: null,
        rowIds: [],
      },
    });

    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        result: { kind: 'error' },
        sectionId: 'portfolio',
        type: 'sectionSourceChanged',
      }),
    ]);
    runtime.dispose();
  });

  it('publishes a complete Portfolio zero as confirmed empty', () => {
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
          authority: IHomeResultAuthority;
          phase: 'final';
          sourceId: 'portfolio';
          wire: {
            confirmedEmpty: boolean;
            empty: boolean;
            error: boolean;
            payload: null;
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: createAuthority('portfolio'),
      phase: 'final',
      sourceId: 'portfolio',
      wire: {
        confirmedEmpty: true,
        empty: true,
        error: false,
        payload: null,
        rowIds: [],
      },
    });

    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        result: {
          confirmedEmpty: true,
          coverageFingerprint: 'confirmed-empty:portfolio:v1',
          kind: 'empty',
        },
        sectionId: 'portfolio',
        type: 'sectionSourceChanged',
      }),
    ]);
    runtime.dispose();
  });

  it('settles only the active source authority after scheduler failure', () => {
    const dispatchAtomically = jest.fn();
    const state = {} as IHomeStoreState;
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
    const authority = createAuthority('banner');
    const privateRuntime = runtime as unknown as {
      activeAuthority: Map<string, IHomeResultAuthority>;
      commitSourceFailure(
        inputAuthority: IHomeResultAuthority,
        sourceId: 'banner',
        errorKind: 'transport',
      ): void;
    };
    privateRuntime.activeAuthority.set('banner', authority);

    privateRuntime.commitSourceFailure(authority, 'banner', 'transport');
    privateRuntime.commitSourceFailure(
      { ...authority, requestSequence: 2 },
      'banner',
      'transport',
    );

    expect(dispatchAtomically).toHaveBeenCalledTimes(1);
    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        token: expect.objectContaining({ requestSeq: 1 }),
        type: 'sourceRequested',
      }),
      expect.objectContaining({
        envelope: expect.objectContaining({
          result: { errorKind: 'transport', kind: 'error' },
          token: expect.objectContaining({ requestSeq: 1 }),
        }),
        type: 'sourceResponded',
      }),
    ]);
    runtime.dispose();
  });

  it('marks a cached Section as refreshing without emitting a loading result', () => {
    const dispatch = jest.fn();
    const authority = createAuthority('portfolio');
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
        surfaceVisibility: 'visible',
      },
      resources: {
        portfolio: {
          kind: 'ready',
          coverageFingerprint: 'cached',
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
      commitBudget: {
        submit: jest.fn((publication: { commit(): void }) => {
          publication.commit();
          return true;
        }),
      } as never,
      leafPool: {
        cancelSession: jest.fn(),
        dispose: jest.fn(),
        getSnapshot: jest.fn(),
        run: jest.fn(),
      } as never,
      dispatch,
      dispatchAtomically: jest.fn(),
      getStateView: () => state,
    });
    const privateRuntime = runtime as unknown as {
      activeAuthority: Map<string, IHomeResultAuthority>;
      scheduleSourceStart(
        sourceId: 'portfolio',
        inputAuthority: IHomeResultAuthority,
        priority: 'critical',
      ): void;
    };
    privateRuntime.activeAuthority.set('portfolio', authority);

    privateRuntime.scheduleSourceStart('portfolio', authority, 'critical');

    expect(dispatch).toHaveBeenCalledWith({
      type: 'sourceRequested',
      token: expect.objectContaining({
        requestSeq: authority.requestSequence,
        sourceKey: expect.objectContaining({
          paramsFingerprint: authority.sourceKey,
          sourceId: 'portfolio',
        }),
      }),
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        result: { kind: 'loading' },
        type: 'sectionSourceChanged',
      }),
    );
    runtime.dispose();
  });

  it('overlays a live intermediate on cached Portfolio rows', () => {
    const dispatchAtomically = jest.fn();
    const cachedToken = createToken('cached', 'CACHED');
    const updatedToken = createToken('updated', 'UPDATED');
    const liveToken = createToken('live', 'LIVE');
    const cachedPayload = {
      ...createHomeSpotSnapshotDefaults(),
      displayIds: ['updated', 'cached'],
      fundedIds: ['updated', 'cached'],
      tokenListMap: {
        updated: createFiat('10'),
        cached: createFiat('20'),
      },
      tapTokenMap: {
        updated: createFiat('10'),
        cached: createFiat('20'),
      },
      tokens: [updatedToken, cachedToken],
    };
    const livePayload = {
      ...createHomeSpotSnapshotDefaults(),
      displayIds: ['updated', 'live'],
      fundedIds: ['updated', 'live'],
      tokenListMap: {
        updated: createFiat('30'),
        live: createFiat('1'),
      },
      tapTokenMap: {
        updated: createFiat('30'),
        live: createFiat('1'),
      },
      tokens: [updatedToken, liveToken],
    };
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        portfolio: {
          kind: 'ready',
          coverageFingerprint: '2:updated:cached',
          data: {
            payload: cachedPayload,
            section: {
              kind: 'ready',
              rowIds: cachedPayload.displayIds,
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
      dispatch: jest.fn(),
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: IHomeResultAuthority;
          phase: 'intermediate';
          sourceId: 'portfolio';
          wire: {
            empty: boolean;
            error: boolean;
            payload: typeof livePayload;
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: createAuthority('portfolio'),
      phase: 'intermediate',
      sourceId: 'portfolio',
      wire: {
        empty: false,
        error: false,
        payload: livePayload,
        rowIds: [...livePayload.displayIds],
      },
    });

    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        result: expect.objectContaining({
          data: expect.objectContaining({
            displayIds: ['updated', 'cached', 'live'],
            tokenListMap: expect.objectContaining({
              cached: expect.objectContaining({ fiatValue: '20' }),
              updated: expect.objectContaining({ fiatValue: '30' }),
            }),
          }),
          freshness: 'confirmedCache',
          kind: 'ready',
          refresh: 'refreshing',
          rowIds: ['updated', 'cached', 'live'],
        }),
        sectionId: 'portfolio',
        type: 'sectionSourceChanged',
      }),
    ]);
    runtime.dispose();
  });

  it('replaces cached Portfolio rows with the final live result', () => {
    const dispatchAtomically = jest.fn();
    const cachedPayload = {
      ...createHomeSpotSnapshotDefaults(),
      displayIds: ['cached'],
      fundedIds: ['cached'],
      tokenListMap: { cached: createFiat('20') },
      tapTokenMap: { cached: createFiat('20') },
      tokens: [createToken('cached', 'CACHED')],
    };
    const livePayload = {
      ...createHomeSpotSnapshotDefaults(),
      displayIds: ['live'],
      fundedIds: ['live'],
      tokenListMap: { live: createFiat('30') },
      tapTokenMap: { live: createFiat('30') },
      tokens: [createToken('live', 'LIVE')],
    };
    const state = {
      session: {
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
      },
      resources: {
        portfolio: {
          kind: 'ready',
          coverageFingerprint: '1:cached:cached',
          data: {
            payload: cachedPayload,
            section: { kind: 'ready', rowIds: ['cached'] },
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
      dispatch: jest.fn(),
      dispatchAtomically,
      getStateView: () => state,
    });
    const commitWireResult = (
      runtime as unknown as {
        commitWireResult(input: {
          authority: IHomeResultAuthority;
          phase: 'final';
          sourceId: 'portfolio';
          wire: {
            empty: boolean;
            error: boolean;
            payload: typeof livePayload;
            rowIds: string[];
          };
        }): void;
      }
    ).commitWireResult.bind(runtime);

    commitWireResult({
      authority: createAuthority('portfolio'),
      phase: 'final',
      sourceId: 'portfolio',
      wire: {
        empty: false,
        error: false,
        payload: livePayload,
        rowIds: [...livePayload.displayIds],
      },
    });

    expect(dispatchAtomically).toHaveBeenCalledWith([
      expect.objectContaining({
        result: expect.objectContaining({
          data: livePayload,
          freshness: 'live',
          kind: 'ready',
          refresh: 'idle',
          rowIds: ['live'],
        }),
        sectionId: 'portfolio',
        type: 'sectionSourceChanged',
      }),
    ]);
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
