/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { fireEvent, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETokenSelectorSyntheticRowType } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { formatNativeSelectorAmount } from './nativeSelectorFormat';
import { NativeTokenSelectorList } from './NativeTokenSelectorList';

import type {
  NativeListSnapshot,
  RowPatch,
} from '@onekeyfe/react-native-native-list';

let mockSnapshot: NativeListSnapshot | undefined;
let mockListSidecar: ReactNode;
const mockSnapshotProps: NativeListSnapshot[] = [];
const getMockSnapshot = () => mockSnapshot;
const mockApplyPatches = jest.fn((patches: readonly RowPatch[]) => {
  if (!mockSnapshot) return;
  mockSnapshot = {
    ...mockSnapshot,
    rows: mockSnapshot.rows.map((row) => {
      const patch = patches.find(
        (item) => item.key === row.key && item.type === row.type,
      );
      if (patch?.type === 'dataRow' && row.type === 'dataRow') {
        return { ...row, ...patch.changes };
      }
      if (patch?.type === 'identity' && row.type === 'identity') {
        return { ...row, ...patch.changes };
      }
      return row;
    }),
  };
});
let mockHomeFiatMap: Record<string, ITokenFiat | undefined> = {};
let mockCurrencyId = 'usd';
const mockCurrencyMap = { usd: { unit: '$' }, eur: { unit: '€' } };
let mockIntl = { formatMessage: ({ id }: { id: string }) => id };
let mockTheme = {
  background: '#FFFFFF',
  primaryText: '#000000',
  secondaryText: '#888888',
  iconSubdued: '#888888',
  inverseBackground: '#000000',
  inverseText: '#FFFFFF',
  accent: '#FF0000',
};
let mockCreateAccountState: {
  isCreating: boolean;
  token: IAccountToken | null;
} = { isCreating: false, token: null };
let mockProcessingTokenState: {
  isProcessing: boolean;
  token: IAccountToken | null;
} = { isProcessing: false, token: null };
const mockEmptySubFiatMap = {};
const mockSwap = jest.fn();

jest.mock('@onekeyfe/react-native-native-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeList: React.forwardRef(
      (
        {
          snapshot,
          listSidecar,
          onRowAction,
        }: {
          snapshot: NativeListSnapshot;
          listSidecar?: ReactNode;
          onRowAction: (event: { actionKey: string; rowKey: string }) => void;
        },
        ref,
      ) => {
        React.useImperativeHandle(ref, () => ({
          applyPatches: mockApplyPatches,
        }));
        mockSnapshotProps.push(snapshot);
        mockListSidecar = listSidecar;
        if (!mockSnapshot || mockSnapshotProps.at(-2) !== snapshot) {
          mockSnapshot = snapshot;
        }
        return React.createElement(
          'div',
          null,
          snapshot.rows.map((row) =>
            React.createElement(
              'div',
              { key: row.key },
              React.createElement(
                'button',
                {
                  'data-testid': row.key,
                  onClick: () =>
                    onRowAction({
                      actionKey: row.type === 'system' ? 'retry' : 'press',
                      rowKey: row.key,
                    }),
                },
                row.key,
              ),
              row.type === 'dataRow' && row.trailing?.length
                ? React.createElement(
                    'button',
                    {
                      'data-testid': `swap-${row.key}`,
                      onClick: () =>
                        onRowAction({ actionKey: 'swap', rowKey: row.key }),
                    },
                    'swap',
                  )
                : null,
            ),
          ),
        );
      },
    ),
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    SizableText: Container,
    Stack: Container,
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: mockCurrencyId } }],
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
}));

jest.mock('../../views/Home/hooks/useHomeNativeListTheme', () => ({
  useHomeNativeListTheme: () => mockTheme,
}));
jest.mock('./nativeSelectorFormat', () => {
  const actual = jest.requireActual<typeof import('./nativeSelectorFormat')>(
    './nativeSelectorFormat',
  );
  return {
    formatNativeSelectorAmount: jest.fn(actual.formatNativeSelectorAmount),
  };
});

jest.mock('../../states/jotai/contexts/tokenList', () => ({
  useCreateAccountStateAtom: () => [mockCreateAccountState],
  useProcessingTokenStateAtom: () => [mockProcessingTokenState],
}));

jest.mock('../Loading', () => ({ ListLoading: () => null }));
jest.mock('./TokenActionsView', () => ({
  __esModule: true,
  default: function MockTokenActionsView({
    token,
    nativeActionState,
  }: {
    token: IAccountToken;
    nativeActionState?: (state: {
      disabled: boolean;
      onPress: () => void;
    }) => void;
  }) {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      nativeActionState?.({
        disabled: false,
        onPress: () => {
          mockSwap(token.$key);
        },
      });
    }, [nativeActionState, token.$key]);
    return null;
  },
}));
jest.mock('../../states/jotai/contexts/tokenList/cells/useTokenFiat', () => ({
  useTokenFiat: (key: string) => mockHomeFiatMap[key],
}));
jest.mock(
  '../../states/jotai/contexts/tokenList/cells/useAggregateSubTokenFiatMap',
  () => ({ useAggregateSubTokenFiatMap: () => mockEmptySubFiatMap }),
);

const ethToken: IAccountToken = {
  $key: 'evm--1_usdt',
  networkId: 'evm--1',
  address: '0xeth',
  decimals: 6,
  name: 'Tether USD',
  symbol: 'USDT',
  isNative: false,
};
const arbToken: IAccountToken = {
  ...ethToken,
  $key: 'evm--42161_usdt',
  networkId: 'evm--42161',
  address: '0xarb',
};

it('omits an absent Home sidecar so token rows remain a valid list input', () => {
  const wasNative = platformEnv.isNative;
  platformEnv.isNative = true;
  try {
    render(
      <NativeTokenSelectorList
        rows={[ethToken]}
        networkId="evm--1"
        crossNetworkGroupingActive={false}
        zeroFillMissingFiat={false}
        showProcessingState={false}
        isSearching={false}
        currentNetworkName="Ethereum"
        empty={<div />}
        sidecar={null}
      />,
    );
  } finally {
    platformEnv.isNative = wasNative;
  }
  expect(mockListSidecar).toBeUndefined();
  expect(mockSnapshot?.rows).toHaveLength(1);
});

it('keeps cross-network badges scoped and dispatches the selected token and retry', () => {
  const onPressToken = jest.fn();
  const onSearchTokensRetry = jest.fn();
  const { getByTestId } = render(
    <NativeTokenSelectorList
      rows={[
        ethToken,
        arbToken,
        {
          $key: 'cross-network-search__otherNetworksSearchError',
          syntheticRowType:
            ETokenSelectorSyntheticRowType.OtherNetworksSearchError,
        },
      ]}
      networkId="evm--1"
      networksMap={{
        'evm--1': { id: 'evm--1', name: 'Ethereum' } as IServerNetwork,
        'evm--42161': {
          id: 'evm--42161',
          name: 'Arbitrum',
        } as IServerNetwork,
      }}
      crossNetworkGroupingActive
      zeroFillMissingFiat={false}
      showProcessingState={false}
      isTokenSelector
      isSearching={false}
      currentNetworkName="Ethereum"
      empty={<div />}
      onPressToken={onPressToken}
      onSearchTokensRetry={onSearchTokensRetry}
    />,
  );
  const ethRow = mockSnapshot?.rows.find((row) => row.key === ethToken.$key);
  const arbRow = mockSnapshot?.rows.find((row) => row.key === arbToken.$key);
  expect(ethRow?.type).toBe('identity');
  expect(arbRow?.type).toBe('identity');
  if (ethRow?.type === 'identity' && arbRow?.type === 'identity') {
    expect(ethRow.badges).toEqual([]);
    expect(arbRow.badges).toEqual([{ key: 'network', text: 'Arbitrum' }]);
  }
  fireEvent.click(getByTestId(arbToken.$key));
  expect(onPressToken).toHaveBeenCalledWith(arbToken);
  fireEvent.click(
    getByTestId('cross-network-search__otherNetworksSearchError'),
  );
  expect(onSearchTokensRetry).toHaveBeenCalledTimes(1);
});

it('scales a held balance but leaves a searched token without fiat blank', () => {
  render(
    <NativeTokenSelectorList
      rows={[ethToken, arbToken]}
      networkId="evm--1"
      tokenListMap={{
        [ethToken.$key]: {
          balanceParsed: '0.414',
          balanceMultiplier: '1000',
          fiatValue: '0.41',
          currency: 'usd',
        } as ITokenFiat,
      }}
      crossNetworkGroupingActive={false}
      zeroFillMissingFiat={false}
      showProcessingState={false}
      isTokenSelector
      isSearching={false}
      currentNetworkName="Ethereum"
      empty={<div />}
    />,
  );
  const held = mockSnapshot?.rows.find((row) => row.key === ethToken.$key);
  const searched = mockSnapshot?.rows.find((row) => row.key === arbToken.$key);
  expect(held?.type).toBe('identity');
  expect(searched?.type).toBe('identity');
  if (held?.type === 'identity' && searched?.type === 'identity') {
    expect(held.trailing).toContainEqual(
      expect.objectContaining({
        kind: 'valuePair',
        primary: '414',
        secondary: '$0.41',
      }),
    );
    expect(searched.trailing).toEqual([]);
  }
});

it('keeps the creating address state within the installed NativeList accessory limit', () => {
  const validatorUrl = pathToFileURL(
    join(
      dirname(
        require.resolve('@onekeyfe/react-native-native-list/package.json'),
      ),
      'lib/module/validation.js',
    ),
  ).href;
  const validateInstalledSnapshot = (snapshot: NativeListSnapshot) => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        'import { readFileSync } from "node:fs"; globalThis.__DEV__ = true; const { validateSnapshot } = await import(process.argv[1]); validateSnapshot(JSON.parse(readFileSync(0, "utf8")));',
        validatorUrl,
      ],
      { input: JSON.stringify(snapshot), encoding: 'utf8' },
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  };
  const props = {
    rows: [ethToken, arbToken],
    networkId: 'evm--1',
    isAllNetworks: true,
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: true,
    showProcessingState: true,
    isTokenSelector: true,
    isSearching: true,
    currentNetworkName: 'Ethereum',
    empty: <div />,
  };
  mockCreateAccountState = { isCreating: true, token: ethToken };
  try {
    const { rerender } = render(<NativeTokenSelectorList {...props} />);
    const creating = mockSnapshot?.rows.find(
      (row) => row.key === ethToken.$key,
    );
    validateInstalledSnapshot(mockSnapshot!);
    expect(creating?.type).toBe('identity');
    if (creating?.type === 'identity') {
      expect(creating.trailing).toEqual([
        expect.objectContaining({ kind: 'value' }),
        { kind: 'spinner' },
      ]);
    }
    const other = mockSnapshot?.rows.find((row) => row.key === arbToken.$key);
    expect(other?.type).toBe('identity');
    if (other?.type === 'identity') {
      expect(other.trailing).toEqual([
        expect.objectContaining({ kind: 'valuePair' }),
      ]);
    }
    const actualFiat = {
      balanceParsed: '1.25',
      fiatValue: '1.25',
      currency: 'usd',
    } as ITokenFiat;
    rerender(
      <NativeTokenSelectorList
        {...props}
        tokenListMap={{ [ethToken.$key]: actualFiat }}
      />,
    );
    validateInstalledSnapshot(mockSnapshot!);
    const heldCreating = mockSnapshot?.rows.find(
      (row) => row.key === ethToken.$key,
    );
    expect(heldCreating?.type).toBe('identity');
    if (heldCreating?.type === 'identity') {
      expect(heldCreating.trailing?.map((item) => item.kind)).toEqual([
        'value',
        'spinner',
      ]);
    }
    rerender(
      <NativeTokenSelectorList
        {...props}
        tokenListMap={{ [ethToken.$key]: actualFiat }}
        hideBalanceAndValue
      />,
    );
    validateInstalledSnapshot(mockSnapshot!);
    const hiddenCreating = mockSnapshot?.rows.find(
      (row) => row.key === ethToken.$key,
    );
    expect(hiddenCreating?.type).toBe('identity');
    if (hiddenCreating?.type === 'identity') {
      expect(hiddenCreating.trailing?.map((item) => item.kind)).toEqual([
        'value',
        'spinner',
      ]);
    }
    mockCreateAccountState = { isCreating: false, token: null };
    rerender(<NativeTokenSelectorList {...props} />);
    const completed = mockSnapshot?.rows.find(
      (row) => row.key === ethToken.$key,
    );
    expect(completed?.type).toBe('identity');
    if (completed?.type === 'identity') {
      expect(completed.trailing).toEqual([
        expect.objectContaining({ kind: 'valuePair' }),
      ]);
    }
    validateInstalledSnapshot(mockSnapshot!);
  } finally {
    mockCreateAccountState = { isCreating: false, token: null };
  }
});

it('publishes Home cell values into separate table columns and routes the Swap action', () => {
  mockSwap.mockClear();
  mockApplyPatches.mockClear();
  mockHomeFiatMap = {
    [ethToken.$key]: {
      balanceParsed: '0.414',
      balanceMultiplier: '1000',
      fiatValue: '0.41',
      price: 1.5,
      price24h: 5.5,
      currency: 'usd',
    } as ITokenFiat,
  };
  const props = {
    rows: [ethToken, arbToken],
    networkId: 'evm--1',
    ownerKey: 'owner-A',
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: false,
    showProcessingState: false,
    isSearching: false,
    currentNetworkName: 'Ethereum',
    empty: <div />,
    homeCellSeam: true,
    tableLayout: true,
    withPrice: true,
    withSwapAction: true,
    structuralTransition: { id: 'expand-1', durationMs: 220 },
  };
  const { getByTestId, rerender } = render(
    <NativeTokenSelectorList {...props} />,
  );
  const first = mockSnapshot?.rows[0];
  expect(first?.type).toBe('dataRow');
  if (first?.type === 'dataRow') {
    expect(first.columns.map((column) => column.key)).toEqual([
      'asset',
      'balance',
      'price',
    ]);
    expect(first.columns[1].text).toBe('414');
    expect(first.columns[1].secondaryText).toContain('0.41');
    expect(first.columns[2].text).toContain('1.5');
    expect(first.columns[2].secondaryTone).toBe('positive');
    expect(first.trailing?.[0]).toMatchObject({
      kind: 'button',
      actionKey: 'swap',
      disabled: false,
    });
  }
  fireEvent.click(getByTestId(`swap-${ethToken.$key}`));
  expect(mockSwap).toHaveBeenCalledWith(ethToken.$key);

  const initialSnapshotProp = mockSnapshotProps.at(-1);
  mockApplyPatches.mockClear();

  mockHomeFiatMap = {
    [ethToken.$key]: { ...mockHomeFiatMap[ethToken.$key]!, price24h: -2 },
  };
  rerender(<NativeTokenSelectorList {...props} />);
  expect(mockSnapshotProps.at(-1)).toBe(initialSnapshotProp);
  expect(mockApplyPatches).toHaveBeenCalledTimes(1);
  expect(mockApplyPatches.mock.calls[0][0]).toEqual([
    expect.objectContaining({ type: 'dataRow', key: ethToken.$key }),
  ]);
  const changed = mockSnapshot?.rows[0];
  expect(changed?.type).toBe('dataRow');
  if (changed?.type === 'dataRow') {
    expect(changed.columns[1].text).toBe('414');
    expect(changed.columns[2].secondaryTone).toBe('negative');
  }
  expect(mockSnapshot?.structuralTransition?.id).toBe('expand-1');

  mockApplyPatches.mockClear();
  rerender(
    <NativeTokenSelectorList
      {...props}
      structuralTransition={{ id: 'collapse-2', durationMs: 220 }}
    />,
  );
  expect(mockSnapshotProps.at(-1)).not.toBe(initialSnapshotProp);
  expect(mockSnapshotProps.at(-1)?.structuralTransition?.id).toBe('collapse-2');
  expect(mockApplyPatches).not.toHaveBeenCalled();
});

it('formats and patches only changed selector rows on an immutable fiat update', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    ...ethToken,
    $key: `evm--1_token-${index}`,
    address: `token-${index}`,
    symbol: `T${index}`,
  }));
  const initialFiat: Record<string, ITokenFiat> = Object.fromEntries(
    rows.map((token) => [
      token.$key,
      {
        balanceParsed: '1',
        fiatValue: '1',
        price: 1,
        currency: 'usd',
      } as ITokenFiat,
    ]),
  );
  const props = {
    rows,
    networkId: 'evm--1',
    ownerKey: 'owner-A',
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: false,
    showProcessingState: false,
    isTokenSelector: true,
    isSearching: false,
    currentNetworkName: 'Ethereum',
    empty: <div />,
  };
  mockSnapshot = undefined;
  mockSnapshotProps.length = 0;
  mockApplyPatches.mockClear();
  const { rerender } = render(
    <NativeTokenSelectorList {...props} tokenListMap={initialFiat} />,
  );
  const initialSnapshot = mockSnapshotProps.at(-1);
  const unchangedRow = getMockSnapshot()?.rows[500];
  jest.mocked(formatNativeSelectorAmount).mockClear();
  const changedIndices = [2, 15, 40, 95, 280, 350, 610, 704, 850, 999];
  const updatedFiat = { ...initialFiat };
  for (const index of changedIndices) {
    const token = rows[index];
    updatedFiat[token.$key] = {
      ...initialFiat[token.$key],
      fiatValue: '2',
      price: 2,
    };
  }
  rerender(<NativeTokenSelectorList {...props} tokenListMap={updatedFiat} />);

  expect(
    jest.mocked(formatNativeSelectorAmount).mock.calls.length,
  ).toBeLessThan(100);
  expect(mockSnapshotProps.at(-1)).toBe(initialSnapshot);
  expect(mockApplyPatches).toHaveBeenCalledTimes(1);
  expect(mockApplyPatches.mock.calls[0][0].map((patch) => patch.key)).toEqual(
    changedIndices.map((index) => rows[index].$key),
  );
  expect(getMockSnapshot()?.rows[500]).toBe(unchangedRow);
  const changedRow = getMockSnapshot()?.rows[2];
  expect(changedRow?.type).toBe('identity');
  if (changedRow?.type === 'identity') {
    expect(changedRow.trailing).toContainEqual(
      expect.objectContaining({ kind: 'valuePair', secondary: '$2.00' }),
    );
  }
});

it('refreshes an aggregate row when only a member fiat entry changes', () => {
  const aggregate = {
    ...ethToken,
    $key: 'all-usdt',
    networkId: 'all-network',
    isAggregateToken: true,
  };
  const members = [ethToken, arbToken];
  const aggregateTokenListMap = { [aggregate.$key]: { tokens: members } };
  const networksMap = {
    'evm--1': {
      id: ethToken.networkId,
      name: 'Ethereum',
    } as IServerNetwork,
    'evm--42161': {
      id: arbToken.networkId,
      name: 'Arbitrum',
    } as IServerNetwork,
  };
  const props = {
    rows: [aggregate],
    networkId: 'all-network',
    ownerKey: 'owner-A',
    networksMap,
    aggregateTokenListMap,
    isAllNetworks: true,
    withNetwork: true,
    withAggregateBadge: true,
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: false,
    showProcessingState: false,
    isTokenSelector: true,
    isSearching: false,
    currentNetworkName: 'All networks',
    empty: <div />,
  };
  const initialMap = {
    [ethToken.$key]: { fiatValue: '0' } as ITokenFiat,
    [arbToken.$key]: { fiatValue: '0' } as ITokenFiat,
  };
  const { rerender } = render(
    <NativeTokenSelectorList {...props} tokenListMap={initialMap} />,
  );
  const initial = mockSnapshot?.rows[0];
  expect(initial?.type).toBe('identity');
  if (initial?.type === 'identity') {
    expect(initial.badges).toContainEqual(
      expect.objectContaining({ key: 'multichain' }),
    );
  }

  const updatedMap = {
    ...initialMap,
    [arbToken.$key]: { fiatValue: '5' } as ITokenFiat,
  };
  rerender(<NativeTokenSelectorList {...props} tokenListMap={updatedMap} />);
  const changed = mockSnapshot?.rows[0];
  expect(changed?.type).toBe('identity');
  expect(changed).not.toBe(initial);
  if (changed?.type === 'identity') {
    expect(changed.badges).toContainEqual(
      expect.objectContaining({ key: 'network', text: 'Arbitrum' }),
    );
    expect(changed.badges).not.toContainEqual(
      expect.objectContaining({ key: 'multichain' }),
    );
  }
});

it('replaces a zero-filled row with real fiat and clears removed holdings', () => {
  const props = {
    rows: [ethToken, arbToken],
    networkId: 'evm--1',
    ownerKey: 'owner-A',
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: true,
    showProcessingState: false,
    isTokenSelector: true,
    isSearching: false,
    currentNetworkName: 'Ethereum',
    empty: <div />,
  };
  const { rerender } = render(<NativeTokenSelectorList {...props} />);
  const zeroRow = mockSnapshot?.rows[0];
  expect(zeroRow?.type).toBe('identity');
  if (zeroRow?.type === 'identity') {
    expect(zeroRow.trailing).toContainEqual(
      expect.objectContaining({ kind: 'valuePair', primary: '0' }),
    );
  }

  const fiat = {
    [ethToken.$key]: {
      balanceParsed: '4',
      fiatValue: '5',
      currency: 'usd',
    } as ITokenFiat,
  };
  rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
  const realRow = mockSnapshot?.rows[0];
  expect(realRow?.type).toBe('identity');
  if (realRow?.type === 'identity') {
    expect(realRow.trailing).toContainEqual(
      expect.objectContaining({
        kind: 'valuePair',
        primary: '4',
        secondary: '$5.00',
      }),
    );
  }

  rerender(<NativeTokenSelectorList {...props} zeroFillMissingFiat={false} />);
  const missingRow = mockSnapshot?.rows[0];
  expect(missingRow?.type).toBe('identity');
  if (missingRow?.type === 'identity') {
    expect(missingRow.trailing).toEqual([]);
  }
});

it('invalidates selector rows for owner, presentation, and processing changes', () => {
  const nativeToken = { ...ethToken, isNative: true };
  const fiat = {
    [ethToken.$key]: {
      balanceParsed: '1',
      fiatValue: '1',
      currency: 'usd',
    } as ITokenFiat,
  };
  const props = {
    rows: [nativeToken, arbToken],
    networkId: 'evm--1',
    ownerKey: 'owner-A',
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: true,
    showProcessingState: true,
    isTokenSelector: true,
    isSearching: false,
    currentNetworkName: 'Ethereum',
    empty: <div />,
  };
  const { rerender } = render(
    <NativeTokenSelectorList {...props} tokenListMap={fiat} />,
  );
  const initialSnapshot = mockSnapshotProps.at(-1);
  const initialRow = mockSnapshot?.rows[0];
  try {
    mockProcessingTokenState = { isProcessing: true, token: ethToken };
    rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
    const processing = mockSnapshot?.rows[0];
    expect(processing?.type).toBe('identity');
    if (processing?.type === 'identity') {
      expect(processing.trailing).toContainEqual({ kind: 'spinner' });
    }
    const disabledOther = mockSnapshot?.rows[1];
    expect(disabledOther?.type).toBe('identity');
    if (disabledOther?.type === 'identity') {
      expect(disabledOther.disabled).toBe(true);
    }

    mockProcessingTokenState = { isProcessing: false, token: null };
    mockCurrencyId = 'eur';
    rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
    expect(mockSnapshot?.rows[0]).not.toBe(processing);

    const beforeLocale = mockSnapshot?.rows[0];
    mockIntl = { formatMessage: ({ id }: { id: string }) => `other:${id}` };
    rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
    const afterLocale = mockSnapshot?.rows[0];
    expect(afterLocale).not.toBe(beforeLocale);
    mockTheme = { ...mockTheme, background: '#101010' };
    rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
    expect(mockSnapshot?.theme?.background).toBe('#101010');
    expect(mockSnapshot?.rows[0]).not.toBe(afterLocale);

    const beforeOwner = mockSnapshotProps.at(-1);
    rerender(
      <NativeTokenSelectorList
        {...props}
        ownerKey="owner-B"
        tokenListMap={fiat}
      />,
    );
    expect(mockSnapshotProps.at(-1)).not.toBe(beforeOwner);
    expect(mockSnapshot?.rows[0]).not.toBe(initialRow);
    expect(mockSnapshotProps.at(-1)).not.toBe(initialSnapshot);
  } finally {
    mockProcessingTokenState = { isProcessing: false, token: null };
    mockCurrencyId = 'usd';
    mockIntl = { formatMessage: ({ id }: { id: string }) => id };
    mockTheme = { ...mockTheme, background: '#FFFFFF' };
  }
});
