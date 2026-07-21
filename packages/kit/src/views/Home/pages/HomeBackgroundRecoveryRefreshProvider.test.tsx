import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';

import fs from 'fs';
import path from 'path';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  markAccountSelectorBackgroundRecoveryRawReady,
  publishAccountSelectorBackgroundRecoveryComplete,
} from '../../../components/AccountSelector/accountSelectorBackgroundRecovery';

import {
  EHomeBackgroundRecoveryRefreshDomain,
  HomeBackgroundRecoveryRefreshProvider,
  type IHomeBackgroundRecoveryOwnerActivation,
  type IHomeBackgroundRecoveryOwnerToken,
  type IHomeBackgroundRecoveryRefreshContext,
  createHomeBackgroundRecoveryRefreshRegistry,
  getLegacyHomeBackgroundRecoveryRefreshDomains,
  getNativeHomeBackgroundRecoveryRefreshSources,
  isHomeBackgroundRecoveryTransactionCurrent,
  runHomeBackgroundRecoveryRefresh,
  useAcknowledgeHomeBackgroundRecoverySurfaceCommit,
  useHomeBackgroundRecoveryStableCallback,
  useRegisterHomeBackgroundRecoveryRefresh,
} from './HomeBackgroundRecoveryRefreshProvider';

let mockIsNativeAndroid = true;
let mockAccountSelectorStorageInitDone = true;
let mockActiveAccountInitDone = true;
type IMockActiveAccount = {
  account?: { id: string };
  network?: { id: string };
  ready: boolean;
  wallet?: { id: string };
};
let mockActiveAccount: IMockActiveAccount = {
  account: { id: 'account-1' },
  network: { id: 'network-1' },
  ready: true,
  wallet: { id: 'wallet-1' },
};
let mockWalletListPending = false;
let mockWalletListResult: {
  wallets: { deprecated?: boolean; id?: string; isMocked?: boolean }[];
} = {
  wallets: [{ id: 'wallet-1' }],
};
const mockRefreshSilently = jest.fn(() => Promise.resolve());
const mockWalletTokensRefresh = jest.fn(() => Promise.resolve());
let resolveMockRecoveryCallback: (() => void) | undefined;
let mockRecoveryCallbackObserved = Promise.resolve();
const mockBannerRefresh = jest.fn(() => {
  resolveMockRecoveryCallback?.();
  return Promise.resolve();
});
const mockThrowingRefresh = jest.fn(() => {
  throw new OneKeyLocalError('expected recovery callback failure');
});
const mockCommittedOwnerCallback = jest.fn();
const mockCandidateOwnerCallback = jest.fn();
const mockNeverCommit = new Promise<void>(() => undefined);
let mockCallbackOwner: 'committed' | 'candidate' = 'committed';
let mockSuspendCallbackCandidate = false;
let committedStableCallback: (() => void) | undefined;
let committedStableCallbackOwner: 'committed' | 'candidate' | undefined;
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  __onekeyAccountSelectorBackgroundRecoveryState?: unknown;
};
let sequence = 8_000_000;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
    isNativeIOS: false,
  },
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [
    mockAccountSelectorStorageInitDone,
  ],
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
  useIsAccountSelectorActiveAccountInitDone: () => mockActiveAccountInitDone,
}));

jest.mock('./HomeWalletListProvider', () => ({
  useHomeWalletList: () => ({
    pending: mockWalletListPending,
    refreshSilently: mockRefreshSilently,
    result: mockWalletListResult,
  }),
}));

function nextSignal(reason: 'initial' | 'recovered' | 'restarted') {
  sequence += 1;
  return {
    bootId: `boot-${sequence}`,
    reason,
    sequence,
  };
}

function publishHome(reason: 'initial' | 'recovered' | 'restarted') {
  const readySignal = nextSignal(reason);
  markHomeRawReady(readySignal);
  publishHomeComplete(readySignal);
  return readySignal;
}

function markHomeRawReady(readySignal: ReturnType<typeof nextSignal>) {
  markAccountSelectorBackgroundRecoveryRawReady({
    owner: {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
    },
    readySignal,
  });
}

function publishHomeComplete(readySignal: ReturnType<typeof nextSignal>) {
  publishAccountSelectorBackgroundRecoveryComplete({
    owner: {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
    },
    readySignal,
  });
}

function getMockOwner(): IHomeBackgroundRecoveryOwnerToken {
  return {
    accountId: mockActiveAccount.account?.id,
    networkId: mockActiveAccount.network?.id,
    walletId: mockActiveAccount.wallet?.id,
  };
}

function createSurfaceCommitRequester({
  owner,
  ownerActivation,
  registry,
  rendererMounted = true,
}: {
  owner: IHomeBackgroundRecoveryOwnerToken;
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  registry: ReturnType<typeof createHomeBackgroundRecoveryRefreshRegistry>;
  rendererMounted?: boolean;
}) {
  let revision = 0;
  return jest.fn(() => {
    revision += 1;
    registry.acknowledgeSurfaceCommit({
      owner,
      ownerActivation,
      rendererMounted,
      revision,
    });
    return revision;
  });
}

function Probe() {
  const owner = getMockOwner();
  useRegisterHomeBackgroundRecoveryRefresh({
    callback: ({ runDomains }) =>
      runDomains([
        EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
        EHomeBackgroundRecoveryRefreshDomain.legacyHeaderPerpsWorth,
        EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
      ]),
    domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
    owner,
  });
  useRegisterHomeBackgroundRecoveryRefresh({
    callback: mockWalletTokensRefresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
    owner,
  });
  useRegisterHomeBackgroundRecoveryRefresh({
    callback: mockThrowingRefresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.legacyHeaderPerpsWorth,
    owner,
  });
  useRegisterHomeBackgroundRecoveryRefresh({
    callback: mockBannerRefresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
    owner,
  });
  return null;
}

function CommittedSurface({ surfaceHasRenderer = true }) {
  useAcknowledgeHomeBackgroundRecoverySurfaceCommit({
    owner: getMockOwner(),
    surfaceHasRenderer,
  });
  return surfaceHasRenderer ? <Probe /> : null;
}

let revealDeferredRenderer: (() => void) | undefined;
function DeferredRendererSurface() {
  const [rendererMounted, setRendererMounted] = useState(false);
  revealDeferredRenderer = () => setRendererMounted(true);
  useAcknowledgeHomeBackgroundRecoverySurfaceCommit({
    owner: getMockOwner(),
    surfaceHasRenderer: rendererMounted,
  });
  return rendererMounted ? <Probe /> : null;
}

function ConcurrentStableCallbackProbe() {
  const callbackOwner = mockCallbackOwner;
  const stableCallback = useHomeBackgroundRecoveryStableCallback(() => {
    if (callbackOwner === 'committed') {
      mockCommittedOwnerCallback();
      return;
    }
    mockCandidateOwnerCallback();
  });
  useLayoutEffect(() => {
    committedStableCallback = stableCallback;
    committedStableCallbackOwner = callbackOwner;
  }, [callbackOwner, stableCallback]);
  if (mockSuspendCallbackCandidate) {
    throw mockNeverCommit;
  }
  return null;
}

describe('Home background recovery refresh registry', () => {
  beforeAll(() => {
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete mockTestGlobal.__onekeyAccountSelectorBackgroundRecoveryState;
    mockIsNativeAndroid = true;
    mockActiveAccount = {
      account: { id: 'account-1' },
      network: { id: 'network-1' },
      ready: true,
      wallet: { id: 'wallet-1' },
    };
    mockAccountSelectorStorageInitDone = true;
    mockActiveAccountInitDone = true;
    mockWalletListPending = false;
    mockWalletListResult = { wallets: [{ id: 'wallet-1' }] };
    mockRecoveryCallbackObserved = new Promise<void>((resolve) => {
      resolveMockRecoveryCallback = resolve;
    });
    revealDeferredRenderer = undefined;
    mockCallbackOwner = 'committed';
    mockSuspendCallbackCandidate = false;
    committedStableCallback = undefined;
    committedStableCallbackOwner = undefined;
  });

  it('uses token-safe cleanup, owner filtering, operation dedupe, and failure isolation', async () => {
    let currentOwner = {
      accountId: 'account-1',
      networkId: 'network-1',
      walletId: 'wallet-1',
    };
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: (owner) =>
        JSON.stringify(owner) === JSON.stringify(currentOwner),
    });
    const first = jest.fn();
    const replacement = jest.fn();
    const throwing = jest.fn(() => {
      throw new OneKeyLocalError('expected');
    });
    const cleanupFirst = registry.register({
      callback: first,
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
      owner: currentOwner,
    });
    registry.register({
      callback: replacement,
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
      owner: currentOwner,
    });
    cleanupFirst();
    registry.register({
      callback: throwing,
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
      owner: currentOwner,
    });
    registry.register({
      callback: jest.fn(),
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyNft,
      operationKey: EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
      owner: currentOwner,
    });

    await registry.runTransaction({
      domains: [
        EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
        EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
        EHomeBackgroundRecoveryRefreshDomain.legacyNft,
      ],
      owner: currentOwner,
      readySignal: nextSignal('recovered'),
    });

    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(throwing).toHaveBeenCalledTimes(1);

    currentOwner = { ...currentOwner, accountId: 'account-2' };
    await registry.runTransaction({
      domains: [EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens],
      owner: {
        accountId: 'account-1',
        networkId: 'network-1',
        walletId: 'wallet-1',
      },
      readySignal: nextSignal('recovered'),
    });
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('awaits the silent wallet refresh as a registration barrier', async () => {
    const owner = {
      accountId: 'account-1',
      networkId: 'network-1',
      walletId: 'wallet-1',
    };
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: (candidate) =>
        JSON.stringify(candidate) === JSON.stringify(owner),
    });
    const ownerActivation = Symbol('owner-account-1');
    const requestSurfaceCommit = createSurfaceCommitRequester({
      owner,
      ownerActivation,
      registry,
    });
    let resolveSilentRefresh!: () => void;
    const silentRefreshCompletion = new Promise<void>((resolve) => {
      resolveSilentRefresh = resolve;
    });
    const refreshWalletListSilently = jest.fn(() => silentRefreshCompletion);
    const rendererRefresh = jest.fn(
      ({ runDomains }: IHomeBackgroundRecoveryRefreshContext) =>
        runDomains([EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens]),
    );
    const walletTokensRefresh = jest.fn();

    const recoveryCompletion = runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: () => true,
      owner,
      ownerActivation,
      readySignal: nextSignal('recovered'),
      refreshWalletListSilently,
      requestSurfaceCommit,
      registry,
    });
    expect(refreshWalletListSilently).toHaveBeenCalledTimes(1);
    expect(rendererRefresh).not.toHaveBeenCalled();

    registry.register({
      callback: rendererRefresh,
      domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
      owner,
    });
    registry.register({
      callback: walletTokensRefresh,
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
      owner,
    });
    resolveSilentRefresh();
    await recoveryCompletion;

    expect(rendererRefresh).toHaveBeenCalledTimes(1);
    expect(walletTokensRefresh).toHaveBeenCalledTimes(1);

    await runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: () => true,
      owner,
      ownerActivation,
      readySignal: nextSignal('recovered'),
      refreshWalletListSilently: () =>
        Promise.reject(new OneKeyLocalError('expected silent refresh failure')),
      requestSurfaceCommit,
      registry,
    });
    expect(rendererRefresh).toHaveBeenCalledTimes(2);
    expect(walletTokensRefresh).toHaveBeenCalledTimes(2);
  });

  it('completes a committed no-renderer surface without a timer or refresh', async () => {
    const owner = getMockOwner();
    const ownerActivation = Symbol('empty-owner');
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: () => true,
    });
    const requestSurfaceCommit = createSurfaceCommitRequester({
      owner,
      ownerActivation,
      registry,
      rendererMounted: false,
    });

    await runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: () => true,
      owner,
      ownerActivation,
      readySignal: nextSignal('recovered'),
      refreshWalletListSilently: () => Promise.resolve(),
      requestSurfaceCommit,
      registry,
    });

    expect(requestSurfaceCommit).toHaveBeenCalledTimes(1);
  });

  it('supersedes sequence N while it waits for its committed surface', async () => {
    const owner = getMockOwner();
    const ownerActivation = Symbol('owner-sequence');
    let currentOwner = owner;
    let currentOwnerActivation = ownerActivation;
    let latestSequence: number | undefined;
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: (candidate) =>
        JSON.stringify(candidate) === JSON.stringify(currentOwner),
    });
    const rendererRefresh = jest.fn();
    registry.register({
      callback: rendererRefresh,
      domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
      owner,
    });
    let resolveNewer!: () => void;
    const newerSilentRefresh = new Promise<void>((resolve) => {
      resolveNewer = resolve;
    });
    const olderSignal = nextSignal('recovered');
    latestSequence = olderSignal.sequence;
    const createGuard =
      (
        transactionSequence: number,
        transactionOwnerActivation: IHomeBackgroundRecoveryOwnerActivation,
      ) =>
      () =>
        isHomeBackgroundRecoveryTransactionCurrent({
          currentOwner,
          currentOwnerActivation,
          latestSequence,
          transactionOwner: owner,
          transactionOwnerActivation,
          transactionSequence,
        });
    let revision = 0;
    const olderRequestSurfaceCommit = jest.fn(() => {
      revision += 1;
      return revision;
    });
    const olderCompletion = runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: createGuard(olderSignal.sequence, ownerActivation),
      owner,
      ownerActivation,
      readySignal: olderSignal,
      refreshWalletListSilently: () => Promise.resolve(),
      requestSurfaceCommit: olderRequestSurfaceCommit,
      registry,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(olderRequestSurfaceCommit).toHaveBeenCalledTimes(1);

    const newerSignal = nextSignal('restarted');
    latestSequence = newerSignal.sequence;
    registry.cancelPendingSurfaceCommitWaiters();
    const newerRequestSurfaceCommit = jest.fn(() => {
      revision += 1;
      registry.acknowledgeSurfaceCommit({
        owner,
        ownerActivation,
        rendererMounted: true,
        revision,
      });
      return revision;
    });
    const newerCompletion = runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: createGuard(newerSignal.sequence, ownerActivation),
      owner,
      ownerActivation,
      readySignal: newerSignal,
      refreshWalletListSilently: () => newerSilentRefresh,
      requestSurfaceCommit: newerRequestSurfaceCommit,
      registry,
    });
    resolveNewer();
    await newerCompletion;
    expect(rendererRefresh).toHaveBeenCalledTimes(1);

    await olderCompletion;
    expect(olderRequestSurfaceCommit).toHaveBeenCalledTimes(1);
    expect(rendererRefresh).toHaveBeenCalledTimes(1);

    currentOwner = owner;
    currentOwnerActivation = ownerActivation;
  });

  it('rechecks the latest sequence before nested renderer callbacks', async () => {
    const owner = getMockOwner();
    const ownerActivation = Symbol('owner-nested-sequence');
    let latestSequence: number | undefined;
    let resolveOlderRenderer!: () => void;
    let markOlderRendererEntered!: () => void;
    const olderRendererGate = new Promise<void>((resolve) => {
      resolveOlderRenderer = resolve;
    });
    const olderRendererEntered = new Promise<void>((resolve) => {
      markOlderRendererEntered = resolve;
    });
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: () => true,
    });
    const leafRefresh = jest.fn();
    registry.register({
      callback: async ({ readySignal, runDomains }) => {
        if (readySignal.sequence === latestSequence) {
          markOlderRendererEntered();
          await olderRendererGate;
        }
        await runDomains([EHomeBackgroundRecoveryRefreshDomain.legacyBanner]);
      },
      domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
      owner,
    });
    registry.register({
      callback: leafRefresh,
      domain: EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
      owner,
    });

    const olderSignal = nextSignal('recovered');
    latestSequence = olderSignal.sequence;
    const olderCompletion = registry.runTransaction({
      domains: [EHomeBackgroundRecoveryRefreshDomain.renderer],
      isTransactionCurrent: () =>
        isHomeBackgroundRecoveryTransactionCurrent({
          currentOwner: owner,
          currentOwnerActivation: ownerActivation,
          latestSequence,
          transactionOwner: owner,
          transactionOwnerActivation: ownerActivation,
          transactionSequence: olderSignal.sequence,
        }),
      owner,
      readySignal: olderSignal,
    });
    await olderRendererEntered;

    const newerSignal = nextSignal('restarted');
    latestSequence = newerSignal.sequence;
    resolveOlderRenderer();
    await olderCompletion;

    expect(leafRefresh).not.toHaveBeenCalled();
  });

  it('does not revive an old A transaction after A to B to A', async () => {
    const ownerA = getMockOwner();
    const ownerB = { ...ownerA, accountId: 'account-2' };
    const activationA1 = Symbol('owner-a-1');
    let currentOwner = ownerA;
    let currentOwnerActivation = activationA1;
    const readySignal = nextSignal('recovered');
    const latestSequence = readySignal.sequence;
    const registry = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: (candidate) =>
        JSON.stringify(candidate) === JSON.stringify(currentOwner),
    });
    const rendererRefresh = jest.fn();
    registry.register({
      callback: rendererRefresh,
      domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
      owner: ownerA,
    });
    let resolveSilentRefresh!: () => void;
    const silentRefreshCompletion = new Promise<void>((resolve) => {
      resolveSilentRefresh = resolve;
    });
    const requestSurfaceCommit = jest.fn(() => 1);
    const recoveryCompletion = runHomeBackgroundRecoveryRefresh({
      isTransactionCurrent: () =>
        isHomeBackgroundRecoveryTransactionCurrent({
          currentOwner,
          currentOwnerActivation,
          latestSequence,
          transactionOwner: ownerA,
          transactionOwnerActivation: activationA1,
          transactionSequence: readySignal.sequence,
        }),
      owner: ownerA,
      ownerActivation: activationA1,
      readySignal,
      refreshWalletListSilently: () => silentRefreshCompletion,
      requestSurfaceCommit,
      registry,
    });

    currentOwner = ownerB;
    currentOwnerActivation = Symbol('owner-b');
    registry.cancelPendingSurfaceCommitWaiters();
    currentOwner = ownerA;
    currentOwnerActivation = Symbol('owner-a-2');
    registry.cancelPendingSurfaceCommitWaiters();
    resolveSilentRefresh();
    await recoveryCompletion;

    expect(requestSurfaceCommit).not.toHaveBeenCalled();
    expect(rendererRefresh).not.toHaveBeenCalled();
  });

  it('waits for the committed renderer when RPC resolves before layout registration', async () => {
    let resolveRpc!: () => void;
    const rpcResolution = new Promise<void>((resolve) => {
      resolveRpc = resolve;
    });
    const serviceCompletion = rpcResolution.then(() => {
      revealDeferredRenderer?.();
    });
    mockRefreshSilently.mockImplementationOnce(() => serviceCompletion);
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <DeferredRendererSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
    });
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();

    act(() => {
      publishHome('recovered');
    });
    await act(async () => {
      resolveRpc();
      await serviceCompletion;
    });
    await mockRecoveryCallbackObserved;

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('invalidates sequence N at raw N+1 before N+1 storage completion', async () => {
    let resolveSequenceN!: () => void;
    const sequenceNSilentRefresh = new Promise<void>((resolve) => {
      resolveSequenceN = resolve;
    });
    mockRefreshSilently
      .mockImplementationOnce(() => sequenceNSilentRefresh)
      .mockImplementationOnce(() => Promise.resolve());
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <CommittedSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
    });

    const sequenceN = nextSignal('recovered');
    act(() => {
      markHomeRawReady(sequenceN);
      publishHomeComplete(sequenceN);
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);

    const sequenceN1 = nextSignal('restarted');
    act(() => {
      markHomeRawReady(sequenceN1);
    });
    await act(async () => {
      resolveSequenceN();
      await sequenceNSilentRefresh;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();
    expect(mockBannerRefresh).not.toHaveBeenCalled();

    act(() => {
      publishHomeComplete(sequenceN);
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);

    await act(async () => {
      publishHomeComplete(sequenceN1);
      await Promise.resolve();
      await Promise.resolve();
    });
    await mockRecoveryCallbackObserved;

    expect(mockRefreshSilently).toHaveBeenCalledTimes(2);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('runs one native Home transaction after recovery without a global broadcast', async () => {
    let resolveSilentRefresh!: () => void;
    const silentRefreshCompletion = new Promise<void>((resolve) => {
      resolveSilentRefresh = resolve;
    });
    mockRefreshSilently.mockImplementationOnce(() => silentRefreshCompletion);
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <CommittedSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
    });

    act(() => {
      publishHome('initial');
    });
    expect(mockRefreshSilently).not.toHaveBeenCalled();

    const recovered = nextSignal('recovered');
    act(() => {
      markAccountSelectorBackgroundRecoveryRawReady({
        owner: {
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: '',
        },
        readySignal: recovered,
      });
      publishAccountSelectorBackgroundRecoveryComplete({
        owner: {
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: '',
        },
        readySignal: recovered,
      });
      markHomeRawReady(recovered);
      publishHomeComplete(recovered);
      publishHomeComplete(recovered);
    });
    await act(async () => {
      resolveSilentRefresh();
      await silentRefreshCompletion;
    });
    await mockRecoveryCallbackObserved;

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);

    act(() => renderer?.unmount());
    renderer = undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <CommittedSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('consumes a recovered completion published before provider mount exactly once', async () => {
    publishHome('recovered');

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <CommittedSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);

    act(() => renderer?.unmount());
    renderer = undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeBackgroundRecoveryRefreshProvider>
            <CommittedSurface />
          </HomeBackgroundRecoveryRefreshProvider>
        </StrictMode>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('waits to claim a latched completion until the real owner is ready', async () => {
    publishHome('recovered');
    mockActiveAccount = { ready: false };

    const renderProvider = () => (
      <StrictMode>
        <HomeBackgroundRecoveryRefreshProvider>
          <CommittedSurface />
        </HomeBackgroundRecoveryRefreshProvider>
      </StrictMode>
    );
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).not.toHaveBeenCalled();
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();

    mockActiveAccount = {
      account: { id: 'account-1' },
      network: { id: 'network-1' },
      ready: true,
      wallet: { id: 'wallet-1' },
    };
    await act(async () => {
      renderer?.update(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer?.update(renderProvider());
      await Promise.resolve();
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('defers a recovered completion for a transient incomplete identity and refreshes the committed BTC owner once', async () => {
    publishHome('recovered');
    mockActiveAccount = { ready: true };

    const renderProvider = () => (
      <StrictMode>
        <HomeBackgroundRecoveryRefreshProvider>
          <CommittedSurface />
        </HomeBackgroundRecoveryRefreshProvider>
      </StrictMode>
    );
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).not.toHaveBeenCalled();
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();

    mockActiveAccount = {
      account: { id: 'account-btc-1' },
      network: { id: 'btc--0' },
      ready: true,
      wallet: { id: 'wallet-1' },
    };
    await act(async () => {
      renderer?.update(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer?.update(renderProvider());
      await Promise.resolve();
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('consumes a recovered completion for a ready no-wallet state without replaying it to a future owner', async () => {
    publishHome('recovered');
    mockActiveAccount = { ready: true };
    mockWalletListResult = { wallets: [] };

    const renderProvider = () => (
      <StrictMode>
        <HomeBackgroundRecoveryRefreshProvider>
          <CommittedSurface />
        </HomeBackgroundRecoveryRefreshProvider>
      </StrictMode>
    );
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).not.toHaveBeenCalled();
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();

    mockActiveAccount = {
      account: { id: 'account-1' },
      network: { id: 'network-1' },
      ready: true,
      wallet: { id: 'wallet-1' },
    };
    mockWalletListResult = { wallets: [{ id: 'wallet-1' }] };
    await act(async () => {
      renderer?.update(renderProvider());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefreshSilently).not.toHaveBeenCalled();
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();

    await act(async () => {
      publishHome('recovered');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockWalletTokensRefresh).toHaveBeenCalledTimes(1);
    expect(mockThrowingRefresh).toHaveBeenCalledTimes(1);
    expect(mockBannerRefresh).toHaveBeenCalledTimes(1);
    act(() => renderer?.unmount());
  });

  it('does not subscribe on desktop, web, or extension-style runtimes', async () => {
    mockIsNativeAndroid = false;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <HomeBackgroundRecoveryRefreshProvider>
          <CommittedSurface />
        </HomeBackgroundRecoveryRefreshProvider>,
      );
    });
    act(() => {
      publishHome('restarted');
    });
    expect(mockRefreshSilently).not.toHaveBeenCalled();
    expect(mockWalletTokensRefresh).not.toHaveBeenCalled();
    act(() => renderer?.unmount());
  });

  it('selects exact Legacy and Native current-tab plans', () => {
    expect(getLegacyHomeBackgroundRecoveryRefreshDomains('portfolio')).toEqual([
      EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
      EHomeBackgroundRecoveryRefreshDomain.legacyPortfolioDeFiOverview,
      EHomeBackgroundRecoveryRefreshDomain.legacyHeaderPerpsWorth,
      EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
    ]);
    expect(getLegacyHomeBackgroundRecoveryRefreshDomains('nft')).toEqual([
      EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
      EHomeBackgroundRecoveryRefreshDomain.legacyPortfolioDeFiOverview,
      EHomeBackgroundRecoveryRefreshDomain.legacyHeaderPerpsWorth,
      EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
      EHomeBackgroundRecoveryRefreshDomain.legacyNft,
    ]);
    expect(getNativeHomeBackgroundRecoveryRefreshSources('portfolio')).toEqual([
      'portfolio',
      'default-token-map',
      'defi',
      'perps',
      'banners',
      'lp-tokens',
      'supplemental',
    ]);
    expect(getNativeHomeBackgroundRecoveryRefreshSources('history')).toEqual([
      'portfolio',
      'default-token-map',
      'defi',
      'perps',
      'banners',
      'history',
    ]);
  });

  it('does not reintroduce global Home refresh broadcasts', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomeBackgroundRecoveryRefreshProvider.tsx'),
      'utf8',
    );
    expect(source).not.toContain('EAppEventBusNames.AccountDataUpdate');
    expect(source).not.toContain('EAppEventBusNames.RefreshTokenList');
    expect(source).not.toContain('onHomePageRefresh');
  });

  it('updates committed owner state only from a layout effect', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'HomeBackgroundRecoveryRefreshProvider.tsx'),
      'utf8',
    );
    const assignment = 'committedOwnerRef.current = {';
    const assignmentIndex = source.indexOf(assignment);
    const layoutEffectIndex = source.lastIndexOf(
      'useLayoutEffect(() => {',
      assignmentIndex,
    );
    const layoutEffectEndIndex = source.indexOf('}, [', assignmentIndex);

    expect(source.match(/committedOwnerRef\.current = \{/g) ?? []).toHaveLength(
      1,
    );
    expect(assignmentIndex).toBeGreaterThan(layoutEffectIndex);
    expect(layoutEffectIndex).toBeGreaterThan(-1);
    expect(layoutEffectEndIndex).toBeGreaterThan(assignmentIndex);
    expect(source).not.toContain('latestOwnerRef.current = currentOwner');
    expect(source).not.toContain('ownerActivationRef.current = {');
  });

  it('keeps the committed owner callback when a recovered signal interrupts a suspended candidate render', async () => {
    const renderProbe = () => (
      <Suspense fallback={null}>
        <HomeBackgroundRecoveryRefreshProvider>
          <ConcurrentStableCallbackProbe />
        </HomeBackgroundRecoveryRefreshProvider>
      </Suspense>
    );
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(renderProbe());
    });
    expect(committedStableCallbackOwner).toBe('committed');

    mockCallbackOwner = 'candidate';
    mockSuspendCallbackCandidate = true;
    mockActiveAccount = {
      account: { id: 'account-2' },
      network: { id: 'network-2' },
      ready: true,
      wallet: { id: 'wallet-2' },
    };
    await act(async () => {
      startTransition(() => renderer?.update(renderProbe()));
      await Promise.resolve();
    });
    expect(committedStableCallbackOwner).toBe('committed');

    mockRefreshSilently.mockImplementationOnce(() => {
      committedStableCallback?.();
      return mockNeverCommit;
    });
    act(() => {
      publishHome('recovered');
    });
    expect(mockRefreshSilently).toHaveBeenCalledTimes(1);
    expect(mockCommittedOwnerCallback).toHaveBeenCalledTimes(1);
    expect(mockCandidateOwnerCallback).not.toHaveBeenCalled();
    act(() => renderer?.unmount());
  });
});
