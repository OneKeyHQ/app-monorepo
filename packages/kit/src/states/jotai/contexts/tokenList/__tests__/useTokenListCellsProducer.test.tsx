/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITokenListFramesPullResult } from '@onekeyhq/kit-bg/src/services/ServiceTokenViewModel';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { jotaiContextStore } from '../../../utils/jotaiContextStore';
import { ProviderJotaiContextTokenList, listStructureAtom } from '../atoms';
import { clearOwnerReplayCache } from '../cells/ownerFrameReplayCache';
import { cell, ensureStoreProjection } from '../cells/projection';
import { useTokenListCellsProducer } from '../cells/useTokenListCellsProducer';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceTokenViewModel: { getTokenListFrames: jest.fn() } },
}));
jest.mock('../../accountSelector', () => ({
  useAccountSelectorContextData: () => ({ store: undefined }),
}));
jest.mock('../cells/coldStart', () => ({
  cancelPendingSlimColdCache: jest.fn(),
  hydrateCellsFromOwnerSlimCache: jest.fn(),
  schedulePersistSlimColdCache: jest.fn(),
}));
jest.mock('../cells/ownerCacheInvalidation', () => ({
  registerHomeTokenListOwnerCacheInvalidation: jest.fn(),
}));

const OWNER_KEY = 'account__network';
const SLOT_ID = 'slot';
const STORE_DATA = { storeName: EJotaiContextStoreNames.homeTokenList };

function structure(
  generation: number,
  orderedIds: string[],
): IStructureSnapshot {
  return {
    ownerKey: OWNER_KEY,
    storeData: STORE_DATA,
    generation,
    orderedIds,
    smallBalanceIds: [],
    nonZeroIds: orderedIds,
    fundedIds: orderedIds,
    metaPatch: {},
    aggMembership: {},
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
  };
}

function fiat(value: string): ITokenFiat {
  return { fiatValue: value, balance: value, balanceParsed: value, price: 1 };
}

function valuation(
  structureGeneration: number,
  changedFiatById: Record<string, ITokenFiat>,
): IValuationFrame {
  return {
    ownerKey: OWNER_KEY,
    storeData: STORE_DATA,
    structureGeneration,
    changedFiatById,
    changedAggFiat: {},
  };
}

function fullPull(
  structureFrame: IStructureSnapshot,
  valuationVersion: number,
  valuationFrame: IValuationFrame,
): ITokenListFramesPullResult {
  return {
    ownerKey: OWNER_KEY,
    slotId: SLOT_ID,
    structureVersion: structureFrame.generation,
    valuationVersion,
    structure: structureFrame,
    valuation: valuationFrame,
    riskyVersion: -1,
    riskyTokens: [],
    riskyMap: {},
    storeData: STORE_DATA,
  };
}

afterEach(() => {
  clearOwnerReplayCache();
  jotaiContextStore.storeCache.delete(STORE_DATA.storeName);
  jest.resetAllMocks();
});

it.each(['missing', 'wrong base version'])(
  'fills new token balances via full pull when the structure push is %s',
  async (structurePush) => {
    const store = jotaiContextStore.createStore(STORE_DATA);
    const pull = jest.spyOn(
      backgroundApiProxy.serviceTokenViewModel,
      'getTokenListFrames',
    );
    const latest = fullPull(
      structure(2, ['existing', 'added']),
      1,
      valuation(2, { existing: fiat('2'), added: fiat('3') }),
    );
    let finishResync!: (frames: ITokenListFramesPullResult) => void;
    pull
      .mockResolvedValueOnce(
        fullPull(
          structure(0, ['existing']),
          0,
          valuation(0, { existing: fiat('1') }),
        ),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishResync = resolve;
        }),
      )
      .mockResolvedValue(latest);

    const wrapper = ({ children }: PropsWithChildren) => (
      <ProviderJotaiContextTokenList store={store}>
        {children}
      </ProviderJotaiContextTokenList>
    );
    renderHook(() => useTokenListCellsProducer(OWNER_KEY, 'usd'), { wrapper });
    await act(async () => {});
    expect(store.get(cell(store, 'existing'))?.fiatValue).toBe('1');

    if (structurePush === 'wrong base version') {
      appEventBus.emit(EAppEventBusNames.TokenListStructureFrame, {
        ownerKey: OWNER_KEY,
        slotId: SLOT_ID,
        isDelta: true,
        baseVersion: 1,
        structureVersion: 2,
        structure: structure(2, ['existing', 'added']),
      });
    }
    appEventBus.emit(EAppEventBusNames.TokenListValuationFrame, {
      ownerKey: OWNER_KEY,
      slotId: SLOT_ID,
      isDelta: true,
      baseVersion: 0,
      valuationVersion: 1,
      valuation: valuation(2, { existing: fiat('2'), added: fiat('3') }),
    });

    expect(pull.mock.calls).toEqual([
      [{ ownerKey: OWNER_KEY }],
      [{ ownerKey: OWNER_KEY }],
    ]);
    expect(ensureStoreProjection(store).appliedValuationVersion).toBe(0);
    expect(ensureStoreProjection(store).cells.has('added')).toBe(false);

    await act(async () => finishResync(latest));
    expect(store.get(listStructureAtom()).orderedIds).toEqual([
      'existing',
      'added',
    ]);
    expect(store.get(cell(store, 'added'))?.fiatValue).toBe('3');

    const pullCount = pull.mock.calls.length;
    appEventBus.emit(EAppEventBusNames.TokenListValuationFrame, {
      ownerKey: OWNER_KEY,
      slotId: SLOT_ID,
      isDelta: true,
      baseVersion: 1,
      valuationVersion: 2,
      valuation: valuation(2, { added: fiat('4') }),
    });
    expect(store.get(cell(store, 'added'))?.fiatValue).toBe('4');
    expect(pull).toHaveBeenCalledTimes(pullCount);
  },
);
