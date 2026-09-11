/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import {
  buildAccountSelectorRowPatchesV2,
  useAccountSelectorNativeSnapshotV2,
} from './accountSelectorAccountRowsV2';

import type {
  IdentityRow,
  NativeListRef,
  NativeListSnapshot,
} from '@onekeyfe/react-native-native-list';

jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector',
  () => ({}),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/shared/src/locale', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({}));
jest.mock('../accountSelectorNativeListV2', () => ({}));
jest.mock('./accountSelectorValueRowsV2', () => ({}));

const baseRow: IdentityRow = {
  type: 'identity',
  leading: { kind: 'account' },
  key: 'account-0',
  title: 'Account 0',
  selected: false,
  subtitleSegments: [{ text: '--' }],
};
const snapshot = (row = baseRow, generation = 1): NativeListSnapshot => ({
  schemaVersion: 1,
  layout: { kind: 'linear' },
  generation,
  rows: [row],
});

describe('account V2 snapshot updates', () => {
  it('compares a new snapshot once, patches latest values and skips same-reference renders', () => {
    const listRef = {
      current: { applyPatches: jest.fn() } as unknown as NativeListRef,
    };
    const initial = snapshot();
    const { result, rerender } = renderHook(
      ({ current }) =>
        useAccountSelectorNativeSnapshotV2({
          identity: 'wallet-1',
          snapshot: current,
          listRef,
          listHeight: 600,
        }),
      { initialProps: { current: initial } },
    );
    const balance = snapshot({
      ...baseRow,
      subtitleSegments: [{ text: '$1.00' }],
    });
    const metadataRead = jest.fn(() => 1);
    Object.defineProperty(balance, 'generation', {
      enumerable: true,
      get: metadataRead,
    });
    rerender({ current: balance });
    expect(metadataRead).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(initial);
    expect(listRef.current.applyPatches).toHaveBeenCalledTimes(1);
    rerender({ current: balance });
    expect(metadataRead).toHaveBeenCalledTimes(1);
    expect(listRef.current.applyPatches).toHaveBeenCalledTimes(1);
    rerender({
      current: snapshot({
        ...baseRow,
        selected: true,
        subtitleSegments: [{ text: '$1.00' }],
      }),
    });
    expect(listRef.current.applyPatches).toHaveBeenLastCalledWith([
      { type: 'identity', key: baseRow.key, changes: { selected: true } },
    ]);
  });

  it('retains patches received before mount and resets for structure or field removal', () => {
    const listRef: { current: NativeListRef | null } = { current: null };
    const initial = snapshot();
    const { result, rerender } = renderHook(
      ({ current, height, identity }) =>
        useAccountSelectorNativeSnapshotV2({
          identity,
          snapshot: current,
          listRef,
          listHeight: height,
        }),
      {
        initialProps: { current: initial, height: 0, identity: 'wallet-1' },
      },
    );
    const balance = snapshot({
      ...baseRow,
      subtitleSegments: [{ text: '$1.00' }],
    });
    rerender({ current: balance, height: 0, identity: 'wallet-1' });
    const selected = snapshot({
      ...baseRow,
      selected: true,
      subtitleSegments: [{ text: '$1.00' }],
    });
    rerender({ current: selected, height: 0, identity: 'wallet-1' });
    const applyPatches = jest.fn();
    listRef.current = { applyPatches } as unknown as NativeListRef;
    rerender({ current: selected, height: 600, identity: 'wallet-1' });
    expect(applyPatches).toHaveBeenCalledWith([
      {
        type: 'identity',
        key: baseRow.key,
        changes: { selected: true, subtitleSegments: [{ text: '$1.00' }] },
      },
    ]);
    const replacement = snapshot({ ...baseRow, key: 'new-wallet-account' }, 2);
    rerender({ current: replacement, height: 600, identity: 'wallet-1' });
    expect(result.current).toBe(replacement);
    const removed = snapshot(
      {
        type: 'identity',
        leading: { kind: 'account' },
        key: 'new-wallet-account',
        title: 'No subtitle',
      },
      2,
    );
    rerender({ current: removed, height: 600, identity: 'wallet-1' });
    expect(result.current).toBe(removed);
    expect(applyPatches).toHaveBeenCalledTimes(1);
  });

  it('uses the target snapshot immediately when the list identity changes', () => {
    const applyPatches = jest.fn();
    const listRef = {
      current: { applyPatches } as unknown as NativeListRef,
    };
    const initial = snapshot();
    const { result, rerender } = renderHook(
      ({ current, identity }) =>
        useAccountSelectorNativeSnapshotV2({
          identity,
          snapshot: current,
          listRef,
          listHeight: 600,
        }),
      { initialProps: { current: initial, identity: 'wallet-1' } },
    );
    const replacement = snapshot({ ...baseRow, key: 'wallet-2-account' }, 2);
    rerender({ current: replacement, identity: 'wallet-2' });
    expect(result.current).toBe(replacement);
    expect(applyPatches).not.toHaveBeenCalled();
  });

  it('replaces reordered/deleted/action rows but permits explicit empty subtitle patches', () => {
    const initial = snapshot();
    expect(buildAccountSelectorRowPatchesV2(initial, initial)).toEqual([]);
    expect(
      buildAccountSelectorRowPatchesV2(initial, { ...initial, rows: [] }),
    ).toBeUndefined();
    expect(
      buildAccountSelectorRowPatchesV2(
        initial,
        snapshot({ ...baseRow, subtitleSegments: [] }),
      ),
    ).toEqual([
      { type: 'identity', key: baseRow.key, changes: { subtitleSegments: [] } },
    ]);
    const action: NativeListSnapshot = {
      ...initial,
      rows: [{ type: 'action', actionKey: 'add', key: 'add', title: 'Add' }],
    };
    expect(
      buildAccountSelectorRowPatchesV2(action, {
        ...action,
        rows: [
          { type: 'action', actionKey: 'add', key: 'add', title: 'Changed' },
        ],
      }),
    ).toBeUndefined();
  });
});
