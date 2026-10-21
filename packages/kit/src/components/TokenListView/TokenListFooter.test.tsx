/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';
import { atom, createStore, useAtomValue } from 'jotai';

import type { IListStructure } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  cell,
  clearAll,
  ensureStoreProjection,
  meta,
  subcell,
} from '../../states/jotai/contexts/tokenList/cells/projection';

import { TokenListFooter } from './TokenListFooter';

import type { PrimitiveAtom } from 'jotai';

type ITokenStore = Parameters<typeof cell>[0];
let mockStore: ITokenStore;
let mockStructureAtom: PrimitiveAtom<IListStructure>;
let mockOwnerKey = 'owner-a';
const mockRun = jest.fn();

function MockContainer({ children }: PropsWithChildren) {
  return <div>{children}</div>;
}

jest.mock('@onekeyhq/components', () => ({
  Button: MockContainer,
  Icon: () => null,
  IconButton: () => null,
  Popover: () => null,
  SizableText: MockContainer,
  Stack: MockContainer,
  XStack: MockContainer,
  YStack: MockContainer,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: Object.assign(MockContainer, { Text: () => null }),
}));
jest.mock('../Currency', () => ({
  Currency: ({ children }: PropsWithChildren) => (
    <span data-testid="small-balance-subtotal">{children}</span>
  ),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshTokenList: 'RefreshTokenList' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: 0, run: mockRun }),
}));
jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account', address: '0xaccount' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet' },
    },
  }),
}));
jest.mock('../../states/jotai/contexts/tokenList', () => ({
  useListStructureAtom: () => [
    useAtomValue(mockStructureAtom, { store: mockStore }),
  ],
  useRiskyListFrameAtom: () => [
    { riskyTokens: [], riskyMap: {}, ownerKey: mockOwnerKey },
  ],
  useSearchKeyAtom: () => [''],
}));
jest.mock('../../states/jotai/contexts/tokenList/atoms', () => ({
  listStructureAtom: () => mockStructureAtom,
  useTokenListContextData: () => ({ store: mockStore }),
}));
jest.mock('../../states/jotai/contexts/tokenList/cells', () => ({
  useHomeTokenListOwnerKey: () => mockOwnerKey,
}));

function token(key: string, hidden = false): IAccountToken {
  return {
    $key: key,
    address: `0x${key}`,
    symbol: key,
    name: key,
    decimals: 18,
    isNative: false,
    ...(hidden ? { dappName: 'protocol' } : {}),
  };
}

function fiat(value: string): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue: value,
    price: Number(value),
    currency: 'usd',
  };
}

function seed({
  aggregate = false,
  visibleValue = '2',
  ownerKey = mockOwnerKey,
}: {
  aggregate?: boolean;
  visibleValue?: string;
  ownerKey?: string;
} = {}) {
  const visible = token(aggregate ? 'aggregate_visible' : 'visible');
  const hidden = token('hidden', true);
  for (const entry of [hidden, visible]) {
    const { $key, ...metadata } = entry;
    mockStore.set(meta(mockStore, $key), metadata);
  }
  mockStore.set(cell(mockStore, hidden.$key), fiat('6'));
  if (aggregate) {
    mockStore.set(subcell(mockStore, visible.$key, 'evm--1'), fiat('1'));
    mockStore.set(subcell(mockStore, visible.$key, 'evm--137'), fiat('1'));
  } else {
    mockStore.set(cell(mockStore, visible.$key), fiat(visibleValue));
  }
  const structure: IListStructure = {
    orderedIds: [],
    smallBalanceIds: [hidden.$key, visible.$key],
    nonZeroIds: [hidden.$key, visible.$key],
    fundedIds: [hidden.$key, visible.$key],
    aggMembership: aggregate ? { [visible.$key]: ['evm--1', 'evm--137'] } : {},
    ownerKey,
    generation: 0,
    smallBalanceFiatValue: '8',
    ownedAggregateTokenListMap: {},
  };
  mockStore.set(mockStructureAtom, structure);
  return { visible, hidden, structure };
}

function expectSubtotal(value: string) {
  expect(screen.getByTestId('small-balance-subtotal').textContent).toBe(value);
}

describe('TokenListFooter live small-balance subtotal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwnerKey = 'owner-a';
    mockStore = createStore() as ITokenStore;
    mockStructureAtom = atom<IListStructure>({
      orderedIds: [],
      smallBalanceIds: [],
      nonZeroIds: [],
      fundedIds: [],
      aggMembership: {},
      ownerKey: mockOwnerKey,
      generation: -1,
      smallBalanceFiatValue: '0',
      ownedAggregateTokenListMap: {},
    });
  });

  it('updates visible fiat when hidden fiat offsets it and the full subtotal stays unchanged', () => {
    const { visible, hidden, structure } = seed();
    render(<TokenListFooter hideDeFiMarkedTokens />);
    expectSubtotal('2');

    act(() => {
      mockStore.set(cell(mockStore, visible.$key), fiat('3'));
      mockStore.set(cell(mockStore, hidden.$key), fiat('5'));
    });

    expect(mockStore.get(mockStructureAtom)).toBe(structure);
    expectSubtotal('3');
  });

  it('subscribes to aggregate subcell valuation without a structure update', () => {
    const { visible, hidden, structure } = seed({ aggregate: true });
    render(<TokenListFooter hideDeFiMarkedTokens />);
    expectSubtotal('2');

    act(() => {
      mockStore.set(subcell(mockStore, visible.$key, 'evm--1'), fiat('2'));
      mockStore.set(cell(mockStore, hidden.$key), fiat('5'));
    });

    expect(mockStore.get(mockStructureAtom)).toBe(structure);
    expectSubtotal('3');
  });

  it('tracks the filtered rows again after switching the filter off and on', () => {
    const { visible, hidden } = seed();
    const { rerender } = render(<TokenListFooter hideDeFiMarkedTokens />);
    expectSubtotal('2');
    rerender(<TokenListFooter />);
    expectSubtotal('8');
    act(() => {
      mockStore.set(cell(mockStore, visible.$key), fiat('3'));
      mockStore.set(cell(mockStore, hidden.$key), fiat('5'));
    });
    expectSubtotal('8');
    rerender(<TokenListFooter hideDeFiMarkedTokens />);
    expectSubtotal('3');
    act(() => {
      mockStore.set(cell(mockStore, visible.$key), fiat('4'));
      mockStore.set(cell(mockStore, hidden.$key), fiat('4'));
    });
    expectSubtotal('4');
  });

  it('rebinds the same token ids after owner replacement at the same generation', () => {
    seed();
    render(<TokenListFooter hideDeFiMarkedTokens />);
    expectSubtotal('2');
    act(() => {
      clearAll(ensureStoreProjection(mockStore));
      mockOwnerKey = 'owner-b';
      seed({ ownerKey: mockOwnerKey, visibleValue: '3' });
      for (const entry of [token('visible', true), token('hidden')]) {
        const { $key, ...metadata } = entry;
        mockStore.set(meta(mockStore, $key), metadata);
      }
      mockStore.set(cell(mockStore, 'hidden'), fiat('5'));
    });
    expect(mockStore.get(mockStructureAtom).generation).toBe(0);
    expectSubtotal('5');
    act(() => {
      mockStore.set(cell(mockStore, 'visible'), fiat('2'));
      mockStore.set(cell(mockStore, 'hidden'), fiat('6'));
    });
    expectSubtotal('6');
  });
});
