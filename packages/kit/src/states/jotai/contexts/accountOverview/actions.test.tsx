/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { useAccountOverviewActions } from './actions';
import {
  ProviderJotaiContextAccountOverview,
  useAccountWorthAtom,
} from './atoms';

function createWrapper() {
  const store = createStore();
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextAccountOverview store={store}>
        {children}
      </ProviderJotaiContextAccountOverview>
    );
  };
}

describe('account overview worth freshness', () => {
  it('recomputes the create-network scalar when a fresh network value changes', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );
    const accountId = 'watching--evm--0xalice';
    const networkId = 'evm--1';
    const valueKey = `${accountId}_${networkId}`;

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId,
        createAtNetwork: networkId,
        initialized: true,
        worth: { [valueKey]: '10' },
        createAtNetworkWorth: '10',
        merge: true,
        assetSnapshotMetaByKey: { [valueKey]: { localSeq: 1 } },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId,
        createAtNetwork: networkId,
        initialized: true,
        worth: { [valueKey]: '5' },
        createAtNetworkWorth: '5',
        merge: true,
        assetSnapshotMetaByKey: { [valueKey]: { localSeq: 2 } },
      });
    });

    expect(result.current.worth.worth[valueKey]).toBe('5');
    expect(result.current.worth.createAtNetworkWorth).toBe('5');
  });

  it('keeps the create-network scalar tied to its network during merges', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );
    const accountId = 'watching--evm--0xalice';
    const createNetworkId = 'evm--1';
    const otherNetworkId = 'evm--137';
    const createKey = `${accountId}_${createNetworkId}`;
    const otherKey = `${accountId}_${otherNetworkId}`;

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId,
        createAtNetwork: createNetworkId,
        initialized: true,
        worth: { [createKey]: '10' },
        createAtNetworkWorth: '10',
        merge: true,
        assetSnapshotMetaByKey: { [createKey]: { localSeq: 1 } },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId,
        createAtNetwork: createNetworkId,
        initialized: true,
        worth: { [otherKey]: '20' },
        createAtNetworkWorth: '20',
        merge: true,
        assetSnapshotMetaByKey: { [otherKey]: { localSeq: 2 } },
      });
    });

    expect(result.current.worth.worth).toEqual({
      [createKey]: '10',
      [otherKey]: '20',
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('10');
  });

  it('adds a fresh create-at-network value even when its response sequence is older', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-b': '5' },
        createAtNetworkWorth: '0',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-b': { localSeq: 2 },
        },
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
        },
        assetSnapshotMeta: { localSeq: 1 },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-b': '5',
      'account-1_network-a': '7',
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('7');

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '99' },
        createAtNetworkWorth: '99',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
        },
        assetSnapshotMeta: { localSeq: 1 },
      });
    });

    expect(result.current.worth.worth['account-1_network-a']).toBe('7');
    expect(result.current.worth.createAtNetworkWorth).toBe('7');
  });

  it('does not let an unversioned full snapshot delete versioned keys', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: {
          'account-1_network-a': '7',
          'account-1_network-b': '5',
        },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 2 },
          'account-1_network-b': { localSeq: 2 },
        },
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '1' },
        createAtNetworkWorth: '1',
        updateAll: true,
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '7',
      'account-1_network-b': '5',
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('7');
  });

  it('keeps the scalar while hydrating a freshly reset owner from a partial cache', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: false,
        worth: {},
        createAtNetworkWorth: '0',
        reset: true,
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
        },
      });
    });

    expect(result.current.worth.createAtNetworkWorth).toBe('7');
  });

  it('retains omitted networks when an unversioned all-network cache is partial', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'watching--account-1',
        initialized: true,
        worth: {
          'watching--account-1_network-a': '7',
          'watching--account-1_network-b': '5',
        },
        createAtNetwork: 'network-a',
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'watching--account-1_network-a': { localSeq: 2 },
          'watching--account-1_network-b': { localSeq: 2 },
        },
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    // Cache hydration only includes networks with a non-empty cached row and
    // therefore cannot authorize eviction of the omitted network.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'watching--account-1',
        initialized: true,
        worth: { 'watching--account-1_network-a': '8' },
        createAtNetwork: 'network-a',
        createAtNetworkWorth: '8',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'watching--account-1_network-a': { localSeq: 3 },
        },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'watching--account-1_network-a': '8',
      'watching--account-1_network-b': '5',
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('8');
  });

  it('keeps merge:false replacement semantics for an unversioned legacy write', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: {
          'account-1_network-a': '7',
          'account-1_network-b': '5',
        },
        createAtNetworkWorth: '7',
        merge: false,
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '1' },
        createAtNetworkWorth: '1',
        merge: false,
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '1',
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('1');
  });

  it('does not promote a partial network marker to the aggregate marker', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
        },
        assetSnapshotMeta: { localSeq: 1 },
      });
    });

    // The aggregate marker above belongs to an independent network response,
    // so it must not be promoted to a complete-snapshot marker.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-b': '5' },
        createAtNetworkWorth: '5',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-b': { localSeq: 2 },
        },
      });
    });

    expect(result.current.worth.assetSnapshotMeta).toBeUndefined();
    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '7',
      'account-1_network-b': '5',
    });
  });

  it('does not carry the previous owner aggregate marker into a merged update', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
        },
        assetSnapshotMeta: { localSeq: 1 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-2',
        initialized: true,
        worth: { 'account-2_network-b': '5' },
        createAtNetworkWorth: '5',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-2_network-b': { localSeq: 2 },
        },
      });
    });

    expect(result.current.worth.accountId).toBe('account-2');
    expect(result.current.worth.assetSnapshotMeta).toBeUndefined();
  });

  it('uses a complete marker as the fallback for keys without a per-key marker', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '1' },
        createAtNetworkWorth: '1',
        merge: true,
      });
    });

    expect(result.current.worth.worth['account-1_network-a']).toBe('7');
  });

  it('does not let an older per-key marker bypass a newer aggregate marker', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMeta: { localSeq: 10 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '1' },
        createAtNetworkWorth: '1',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 5 },
        },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '2' },
        createAtNetworkWorth: '2',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 6 },
        },
      });
    });

    expect(result.current.worth.worth['account-1_network-a']).toBe('7');
    expect(
      result.current.worth.assetSnapshotMetaByKey?.['account-1_network-a'],
    ).toEqual({ localSeq: 10 });
  });

  it('does not let the previous owner marker gate a complete owner switch', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMeta: { localSeq: 100 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-2',
        initialized: true,
        worth: {},
        createAtNetworkWorth: '0',
        updateAll: true,
        assetSnapshotMeta: { localSeq: 10 },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-2',
        initialized: true,
        worth: { 'account-2_network-a': '99' },
        createAtNetworkWorth: '99',
        merge: true,
        assetSnapshotMetaByKey: {
          'account-2_network-a': { localSeq: 5 },
        },
      });
    });

    expect(result.current.worth.accountId).toBe('account-2');
    expect(result.current.worth.worth).toEqual({});
    expect(result.current.worth.assetSnapshotMeta).toEqual({ localSeq: 10 });
  });

  it('lets a full snapshot evict omitted networks after progressive merges admitted the same responses', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    // Round 1: a complete snapshot that still includes network-c.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: {
          'account-1_network-a': '7',
          'account-1_network-b': '5',
          'account-1_network-c': '3',
        },
        createAtNetworkWorth: '15',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 1 },
          'account-1_network-b': { localSeq: 1 },
          'account-1_network-c': { localSeq: 1 },
        },
        assetSnapshotMeta: { localSeq: 1 },
      });
    });

    // Round 2 (network-c disabled): progressive per-network merges arrive
    // first and admit each response.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '8' },
        createAtNetworkWorth: '8',
        merge: true,
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 2 } },
      });
    });
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-b': '6' },
        createAtNetworkWorth: '6',
        merge: true,
        assetSnapshotMetaByKey: { 'account-1_network-b': { localSeq: 3 } },
      });
    });

    // The full snapshot for the same round re-materializes those responses
    // with EQUAL markers. It must still replace the map and drop network-c.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: {
          'account-1_network-a': '8',
          'account-1_network-b': '6',
        },
        createAtNetworkWorth: '14',
        updateAll: true,
        assetSnapshotMetaByKey: {
          'account-1_network-a': { localSeq: 2 },
          'account-1_network-b': { localSeq: 3 },
        },
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '8',
      'account-1_network-b': '6',
    });
    expect(result.current.worth.assetSnapshotMeta).toEqual({ localSeq: 2 });
    expect(result.current.worth.assetSnapshotMetaByKey).toEqual({
      'account-1_network-a': { localSeq: 2 },
      'account-1_network-b': { localSeq: 3 },
    });
    expect(result.current.worth.createAtNetworkWorth).toBe('14');
  });

  it('still refuses a full snapshot whose omitted network carries a newer marker', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        merge: true,
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 2 } },
      });
    });
    // network-b was refreshed after the full snapshot's oldest response.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-b': '5' },
        createAtNetworkWorth: '5',
        merge: true,
        assetSnapshotMetaByKey: { 'account-1_network-b': { localSeq: 9 } },
      });
    });

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '7' },
        createAtNetworkWorth: '7',
        updateAll: true,
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 2 } },
        assetSnapshotMeta: { localSeq: 2 },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '7',
      'account-1_network-b': '5',
    });
    expect(result.current.worth.assetSnapshotMeta).toBeUndefined();
  });

  it('keeps the currency tag of retained values when a replacement rejects every incoming value', () => {
    const { result } = renderHook(
      () => {
        const actions = useAccountOverviewActions().current;
        const [worth] = useAccountWorthAtom();
        return { actions, worth };
      },
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '70' },
        createAtNetworkWorth: '70',
        merge: false,
        currency: 'cny',
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 5 } },
      });
    });

    // A stale replacement tagged in another currency is rejected; the
    // retained value must keep describing itself as CNY.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '10' },
        createAtNetworkWorth: '10',
        merge: false,
        currency: 'usd',
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 1 } },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '70',
    });
    expect(result.current.worth.currency).toBe('cny');

    // Same for a stale progressive merge.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '11' },
        createAtNetworkWorth: '11',
        merge: true,
        currency: 'usd',
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 2 } },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '70',
    });
    expect(result.current.worth.currency).toBe('cny');

    // A fresh value adopts the incoming tag again.
    act(() => {
      result.current.actions.updateAccountWorth({
        accountId: 'account-1',
        initialized: true,
        worth: { 'account-1_network-a': '10' },
        createAtNetworkWorth: '10',
        merge: false,
        currency: 'usd',
        assetSnapshotMetaByKey: { 'account-1_network-a': { localSeq: 6 } },
      });
    });

    expect(result.current.worth.worth).toEqual({
      'account-1_network-a': '10',
    });
    expect(result.current.worth.currency).toBe('usd');
  });
});
