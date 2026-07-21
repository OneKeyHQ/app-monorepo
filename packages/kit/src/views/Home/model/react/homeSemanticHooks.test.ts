import { renderHook } from '@testing-library/react-native';

import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { createIdleHomeSourceFacts } from '../facts/homeFacts';

import { useStableHomeFactsOwner } from './homeSemanticHooks';

import type { IHomeFacts } from '../facts/homeFacts';

let mockHomeFacts: IHomeFacts | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home', () => ({
  useHomeFactsShadowAtom: () => [mockHomeFacts],
}));

function createHomeFacts({
  connection = 'ready',
  sessionId = 'session-1',
}: {
  connection?: IHomeFacts['runtime']['connection'];
  sessionId?: string;
} = {}): IHomeFacts {
  return {
    owner: {
      walletId: 'wallet-1',
      accountId: 'account-1',
      network: { kind: 'singleNetwork', networkId: 'evm-1' },
    },
    ownerToken: { scopeKey: 'scope-1', sessionId },
    wallet: {
      ready: true,
      hasNetworkAccount: true,
      backupStatus: 'complete',
      accountType: 'hd',
    },
    environment: { theme: 'unknown' },
    runtime: {
      topology: 'split',
      connection,
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
    },
    capabilityInputs: {
      ready: false,
      networkFamily: 'evm',
      accountType: 'hd',
      allNetworks: false,
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
}

describe('useStableHomeFactsOwner', () => {
  beforeEach(() => {
    mockHomeFacts = createHomeFacts();
  });

  it('keeps the owner identity stable when unrelated facts are republished', () => {
    const { result, rerender } = renderHook(() => useStableHomeFactsOwner());
    const firstOwner = result.current;

    mockHomeFacts = createHomeFacts({ connection: 'degraded' });
    rerender({});

    expect(result.current).toBe(firstOwner);
  });

  it('changes the owner identity when the runtime session changes', () => {
    const { result, rerender } = renderHook(() => useStableHomeFactsOwner());
    const firstOwner = result.current;

    mockHomeFacts = createHomeFacts({ sessionId: 'session-2' });
    rerender({});

    expect(result.current).not.toBe(firstOwner);
    expect(result.current?.ownerToken.sessionId).toBe('session-2');
  });
});
