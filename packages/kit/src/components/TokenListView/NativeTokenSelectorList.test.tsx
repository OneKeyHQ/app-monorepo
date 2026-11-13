/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  applyRowPatches,
  planNativeListPatches,
} from '@onekeyfe/react-native-native-list';
import { fireEvent, render } from '@testing-library/react';
import { createStore } from 'jotai';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETokenSelectorSyntheticRowType } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { cell } from '../../states/jotai/contexts/tokenList/cells/projection';

import { formatNativeSelectorAmount } from './nativeSelectorFormat';
import { NativeTokenSelectorList } from './NativeTokenSelectorList';

import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';
import type {
  NativeListSnapshot,
  RowPatch,
} from '@onekeyfe/react-native-native-list';

let mockSnapshot: NativeListSnapshot | undefined;
let mockListSidecar: ReactNode;
let mockExpandedContent: ReactNode;
let mockStructureToggle: ReactNode;
const mockSnapshotProps: NativeListSnapshot[] = [];
const getMockSnapshot = () => mockSnapshot;
const mockApplyPatches = jest.fn((patches: readonly RowPatch[]) => {
  if (!mockSnapshot) return;
  mockSnapshot = applyRowPatches(mockSnapshot, patches);
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
  caution: '#D97706',
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
let mockHomeCellStore: IJotaiContextStore | undefined;
let mockRowLayoutEngine: 'web' | 'native' = 'web';
let mockGtMd = false;

jest.mock('@onekeyfe/react-native-native-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const path = jest.requireActual<typeof import('node:path')>('node:path');
  const {
    applyValidatedRowPatches: actualApplyRowPatches,
    planNativeListPatches: actualPlanner,
  } = jest.requireActual<
    Pick<
      typeof import('@onekeyfe/react-native-native-list'),
      'planNativeListPatches'
    > & {
      applyValidatedRowPatches: (
        snapshot: NativeListSnapshot,
        patches: readonly RowPatch[],
      ) => { snapshot: NativeListSnapshot };
    }
  >(
    path.join(
      path.dirname(
        require.resolve('@onekeyfe/react-native-native-list/package.json'),
      ),
      'lib/module/validation.js',
    ),
  );
  return {
    applyRowPatches: (
      snapshot: NativeListSnapshot,
      patches: readonly RowPatch[],
    ) => actualApplyRowPatches(snapshot, patches).snapshot,
    planNativeListPatches: actualPlanner,
    NativeList: React.forwardRef(
      (
        {
          snapshot,
          listSidecar,
          listExpandedContent,
          listStructureToggle,
          onRowAction,
        }: {
          snapshot: NativeListSnapshot;
          listSidecar?: ReactNode;
          listExpandedContent?: ReactNode;
          listStructureToggle?: ReactNode;
          onRowAction: (event: { actionKey: string; rowKey: string }) => void;
        },
        ref,
      ) => {
        React.useImperativeHandle(ref, () => ({
          applyPatches: mockApplyPatches,
        }));
        mockSnapshotProps.push(snapshot);
        mockListSidecar = listSidecar;
        mockExpandedContent = listExpandedContent;
        mockStructureToggle = listStructureToggle;
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
    useMedia: () => ({ gtMd: mockGtMd }),
    useTheme: () => ({
      iconCaution: { val: '#B88600' },
      textCaution: { val: '#8F6200' },
      bgCautionSubdued: { val: '#FFF6D5' },
    }),
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
  useTokenListContextData: () => ({ store: mockHomeCellStore }),
}));

jest.mock('../Loading', () => ({ ListLoading: () => null }));
// Jest resolves the web platform file; read the row container style from the
// real web or native implementation per test so both contracts are exercised.
jest.mock('./tokenListRowLayout', () => {
  const web = jest.requireActual<typeof import('./tokenListRowLayout')>(
    './tokenListRowLayout',
  );
  const native = jest.requireActual<
    typeof import('./tokenListRowLayout.native')
  >('./tokenListRowLayout.native');
  return {
    ...web,
    get TOKEN_ROW_CONTAINER_STYLE() {
      return (mockRowLayoutEngine === 'native' ? native : web)
        .TOKEN_ROW_CONTAINER_STYLE;
    },
  };
});
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

function validateInstalledSnapshot(snapshot: NativeListSnapshot) {
  const validatorUrl = pathToFileURL(
    join(
      dirname(
        require.resolve('@onekeyfe/react-native-native-list/package.json'),
      ),
      'lib/module/validation.js',
    ),
  ).href;

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
}

it('keeps the passive Web balance badge safe through normalization and row reuse', () => {
  const packageRoot = dirname(
    require.resolve('@onekeyfe/react-native-native-list/package.json'),
  );
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.argv[3]);
const { validateSnapshot, emptyNativeListSnapshot } = await import(process.argv[1]);
const { dataRowRenderer } = await import(process.argv[2]);
const badge = { text: 'Unverified', textColor: '#8F6200', backgroundColor: '#FFF6D5' };
const row = {
  type: 'dataRow', key: 'balance', height: 60,
  columns: [
    { key: 'asset', text: 'XMR' },
    { key: 'balance', text: '2', secondaryText: '$100', alignment: 'end', webLeadingBadge: badge },
  ],
};
const snapshot = { ...emptyNativeListSnapshot(), rows: [row] };
globalThis.__DEV__ = true;
assert.deepEqual(validateSnapshot(snapshot).rows[0].columns[1].webLeadingBadge, badge);
const withBadge = (value) => ({ ...snapshot, rows: [{ ...row, columns: [row.columns[0], { ...row.columns[1], webLeadingBadge: value }] }] });
assert.throws(() => validateSnapshot(withBadge({ ...badge, actionKey: 'verify' })), /web leading badge key/);
assert.throws(() => validateSnapshot(withBadge({ ...badge, textColor: 'orange' })), /textColor/);
globalThis.__DEV__ = false;
assert.deepEqual(validateSnapshot(withBadge({ ...badge, actionKey: 'verify' })).rows[0].columns[1].webLeadingBadge, badge);
for (const value of [null, [], 'Unverified', { ...badge, text: '' }, { ...badge, textColor: 'orange' }]) {
  assert.equal(validateSnapshot(withBadge(value)).rows[0].columns[1].webLeadingBadge, undefined);
}
const document = new JSDOM().window.document;
const primitives = {
  visual: () => undefined,
  dispose: () => {},
  textStyle: () => {},
  accessory: () => { throw new Error('Passive badge must not create an accessory'); },
  iconAction: () => { throw new Error('Passive badge must not create an action'); },
};
const body = dataRowRenderer.create(document, row, primitives);
const cell = body.querySelectorAll('.ok-native-list-data-cell')[1];
const label = cell.querySelector('.ok-native-list-data-leading-badge');
assert.equal(label.hidden, false);
assert.equal(label.textContent, 'Unverified');
assert.equal(label.nextElementSibling.textContent, '2');
assert.equal(label.style.pointerEvents, 'none');
assert.equal(label.style.backgroundColor, 'rgb(255, 246, 213)');
assert.equal(cell.querySelector('.ok-native-list-data-primary').style.gap, '8px');
assert.equal(body.querySelector('[data-native-list-action]'), null);
const verified = { ...row, columns: [row.columns[0], { key: 'balance', text: '2', secondaryText: '$100', alignment: 'end' }] };
dataRowRenderer.bind(body, verified, primitives);
assert.equal(label.hidden, true);
assert.equal(label.textContent, '');
assert.equal(label.style.backgroundColor, '');
assert.equal(cell.querySelector('.ok-native-list-data-primary').style.gap, '');
dataRowRenderer.recycle(body);
dataRowRenderer.bind(body, row, primitives);
assert.equal(label.hidden, false);
assert.equal(label.textContent, 'Unverified');
`,
      pathToFileURL(join(packageRoot, 'lib/module/validation.js')).href,
      pathToFileURL(
        join(packageRoot, 'lib/module/web/templates/DataRowRenderer.js'),
      ).href,
      require.resolve('jsdom'),
    ],
    { encoding: 'utf8' },
  );
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

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

it.each([
  { tableLayout: false, isNative: false, gtMd: false },
  { tableLayout: false, isNative: false, gtMd: true },
  { tableLayout: false, isNative: true, gtMd: false },
  { tableLayout: true, isNative: false, gtMd: false },
  { tableLayout: true, isNative: false, gtMd: true },
])(
  'marks the native balance for verification and retains the normal details action (table: $tableLayout, native: $isNative, wide: $gtMd)',
  ({ tableLayout, isNative, gtMd }) => {
    const wasNative = platformEnv.isNative;
    const wasGtMd = mockGtMd;
    platformEnv.isNative = isNative;
    mockGtMd = gtMd;
    mockRowLayoutEngine = isNative ? 'native' : 'web';
    try {
      const token = {
        ...ethToken,
        $key: 'xmr--0_native',
        networkId: 'xmr--0',
        symbol: 'XMR',
        name: 'Monero',
        isNative: true,
      };
      const onPressToken = jest.fn();
      const props = {
        rows: [token],
        networkId: token.networkId,
        crossNetworkGroupingActive: false,
        zeroFillMissingFiat: false,
        showProcessingState: false,
        isSearching: false,
        currentNetworkName: 'Monero',
        empty: <div />,
        tableLayout,
        withPrice: true,
        onPressToken,
        tokenListMap: {
          [token.$key]: {
            balance: '2000000000000',
            balanceParsed: '2',
            fiatValue: '100',
            price: 50,
          },
        },
      };
      const verification = {
        networkId: token.networkId,
        label: 'Some funds need verification',
      };
      const { rerender, getByTestId } = render(
        <NativeTokenSelectorList
          {...props}
          nativeTokenVerification={verification}
        />,
      );
      const pending = mockSnapshot?.rows[0];
      expect(pending?.type).toBe('dataRow');
      if (pending?.type !== 'dataRow')
        throw new OneKeyLocalError('Expected balance columns');
      const balance = pending.columns.find(({ key }) => key === 'balance');
      expect(balance).toMatchObject({ text: '2' });
      if (!tableLayout) {
        const compactWeb = !isNative && !gtMd;
        expect(pending.columns.find(({ key }) => key === 'asset')?.weight).toBe(
          compactWeb ? 1 : 2,
        );
        expect(balance?.weight).toBe(compactWeb ? 2 : 1);
      }
      if (isNative || !gtMd) {
        expect(balance?.titleIcon).toEqual({
          name: 'InfoCircleOutline',
          tintColor: '#B88600',
          accessibilityLabel: verification.label,
        });
        expect(balance).not.toHaveProperty('webLeadingBadge');
      } else {
        expect(balance?.titleIcon).toBeUndefined();
        expect(balance).toHaveProperty('webLeadingBadge', {
          text: 'global.unverified',
          textColor: '#8F6200',
          backgroundColor: '#FFF6D5',
        });
      }
      expect(
        pending.columns.find(({ key }) => key === 'balance')?.secondaryText,
      ).toContain('100');
      validateInstalledSnapshot(mockSnapshot!);
      fireEvent.click(getByTestId(token.$key));
      expect(onPressToken).toHaveBeenCalledTimes(1);
      expect(onPressToken).toHaveBeenCalledWith(token);

      if (!isNative) {
        mockGtMd = !gtMd;
        rerender(
          <NativeTokenSelectorList
            {...props}
            nativeTokenVerification={verification}
          />,
        );
        const resized = mockSnapshot?.rows[0];
        if (resized?.type !== 'dataRow')
          throw new OneKeyLocalError('Expected balance columns');
        const resizedBalance = resized.columns.find(
          ({ key }) => key === 'balance',
        );
        expect(Boolean(resizedBalance?.titleIcon)).toBe(gtMd);
        expect(Boolean(resizedBalance?.webLeadingBadge)).toBe(!gtMd);
        mockGtMd = gtMd;
      }

      rerender(<NativeTokenSelectorList {...props} />);
      const verified = mockSnapshot?.rows[0];
      if (verified?.type === 'dataRow') {
        expect(
          verified.columns.find(({ key }) => key === 'balance')?.titleIcon,
        ).toBeUndefined();
        expect(
          verified.columns.find(({ key }) => key === 'balance'),
        ).not.toHaveProperty('webLeadingBadge');
      } else {
        expect(verified?.type).toBe('identity');
      }
      validateInstalledSnapshot(mockSnapshot!);

      for (const extra of [
        { isAllNetworks: true },
        { isTokenSelector: true },
        { networkId: 'evm--1' },
        { hideBalanceAndValue: true },
        { rows: [{ ...token, isNative: false }] },
      ]) {
        rerender(
          <NativeTokenSelectorList
            {...props}
            {...extra}
            nativeTokenVerification={verification}
          />,
        );
        const unrelated = mockSnapshot?.rows[0];
        if (unrelated?.type === 'dataRow') {
          expect(
            unrelated.columns.find(({ key }) => key === 'balance')?.titleIcon,
          ).toBeUndefined();
          expect(
            unrelated.columns.find(({ key }) => key === 'balance'),
          ).not.toHaveProperty('webLeadingBadge');
        } else if (unrelated?.type === 'identity') {
          expect(unrelated.titleIcon?.accessibilityLabel).not.toBe(
            verification.label,
          );
        }
      }
    } finally {
      platformEnv.isNative = wasNative;
      mockGtMd = wasGtMd;
      mockRowLayoutEngine = 'web';
    }
  },
);

it.each([
  { isNative: false, gtMd: false },
  { isNative: false, gtMd: true },
  { isNative: true, gtMd: false },
])(
  'keeps verification visible as the balance feed arrives and clears (native: $isNative, wide: $gtMd)',
  ({ isNative, gtMd }) => {
    const wasNative = platformEnv.isNative;
    const wasGtMd = mockGtMd;
    platformEnv.isNative = isNative;
    mockGtMd = gtMd;
    mockRowLayoutEngine = isNative ? 'native' : 'web';
    try {
      const token = {
        ...ethToken,
        $key: 'xmr--0_native',
        networkId: 'xmr--0',
        symbol: 'XMR',
        name: 'Monero',
        isNative: true,
      };
      const onPressToken = jest.fn();
      const props = {
        rows: [token],
        networkId: token.networkId,
        crossNetworkGroupingActive: false,
        zeroFillMissingFiat: false,
        showProcessingState: false,
        isSearching: false,
        currentNetworkName: 'Monero',
        empty: <div />,
        tableLayout: false,
        onPressToken,
        nativeTokenVerification: {
          networkId: token.networkId,
          label: 'Some funds need verification',
        },
      };
      const { rerender, getByTestId } = render(
        <NativeTokenSelectorList {...props} tokenListMap={{}} />,
      );
      for (const tokenListMap of [
        {},
        {
          [token.$key]: {
            balance: '2000000000000',
            balanceParsed: '2',
            fiatValue: '100',
            price: 50,
          },
        },
        {},
      ]) {
        rerender(
          <NativeTokenSelectorList {...props} tokenListMap={tokenListMap} />,
        );
        const row = getMockSnapshot()?.rows[0];
        expect(row?.type).toBe('dataRow');
        if (row?.type !== 'dataRow')
          throw new OneKeyLocalError('Expected verification balance column');
        const balance = row.columns.find(({ key }) => key === 'balance');
        const hasBalance = Object.keys(tokenListMap).length > 0;
        expect(balance?.text).toBe(hasBalance ? '2' : '');
        if (hasBalance) {
          expect(balance?.secondaryText).toContain('100');
        } else {
          expect(balance?.secondaryText).toBe('');
        }
        if (isNative || !gtMd) {
          expect(balance?.titleIcon).toEqual({
            name: 'InfoCircleOutline',
            tintColor: '#B88600',
            accessibilityLabel: props.nativeTokenVerification.label,
          });
          expect(balance).not.toHaveProperty('webLeadingBadge');
        } else {
          expect(balance?.titleIcon).toBeUndefined();
          expect(balance).toHaveProperty(
            'webLeadingBadge.text',
            'global.unverified',
          );
        }
        validateInstalledSnapshot(getMockSnapshot()!);
      }
      fireEvent.click(getByTestId(token.$key));
      expect(onPressToken).toHaveBeenCalledTimes(1);
      expect(onPressToken).toHaveBeenCalledWith(token);
    } finally {
      platformEnv.isNative = wasNative;
      mockGtMd = wasGtMd;
      mockRowLayoutEngine = 'web';
    }
  },
);

it.each([
  { tableLayout: false, isNative: false },
  { tableLayout: false, isNative: true },
  { tableLayout: true, isNative: false },
])(
  'updates the native token sync status without replacing balances or its details action (table: $tableLayout, native: $isNative)',
  ({ tableLayout, isNative }) => {
    const wasNative = platformEnv.isNative;
    platformEnv.isNative = isNative;
    mockRowLayoutEngine = isNative ? 'native' : 'web';
    try {
      const token = {
        ...ethToken,
        $key: 'xmr--0_native',
        networkId: 'xmr--0',
        symbol: 'XMR',
        name: 'Monero',
        isNative: true,
      };
      const onPressToken = jest.fn();
      const props = {
        rows: [token],
        networkId: token.networkId,
        crossNetworkGroupingActive: false,
        zeroFillMissingFiat: false,
        showProcessingState: false,
        isSearching: false,
        currentNetworkName: 'Monero',
        empty: <div />,
        tableLayout,
        withPrice: true,
        onPressToken,
        tokenListMap: {
          [token.$key]: {
            balance: '2000000000000',
            balanceParsed: '2',
            fiatValue: '100',
            price: 50,
          },
        },
      };
      const status = {
        networkId: token.networkId,
        label: 'Syncing',
        loading: true,
      };
      const { rerender, getByTestId } = render(
        <NativeTokenSelectorList {...props} nativeTokenStatus={status} />,
      );
      const syncing = mockSnapshot?.rows[0];
      expect(syncing).toMatchObject({ height: 60 });
      expect(syncing?.type).toBe(
        tableLayout || isNative ? 'dataRow' : 'identity',
      );
      expect(syncing?.disabled).not.toBe(true);
      if (syncing?.type === 'identity') {
        expect(syncing.badges).toEqual([
          { key: 'sync-status', text: 'Syncing' },
        ]);
        expect(syncing.trailing).toEqual([
          { kind: 'spinner' },
          expect.objectContaining({ kind: 'valuePair', primary: '2' }),
        ]);
        expect(syncing.subtitle).toContain('50');
      } else if (syncing?.type === 'dataRow') {
        if (tableLayout) {
          expect(syncing.columns[0].secondaryText).toBe('Syncing');
          expect(syncing.columns).toHaveLength(3);
        } else {
          expect(syncing.badges).toEqual([
            { key: 'sync-status', text: 'Syncing' },
          ]);
          expect(syncing.columns).toHaveLength(2);
          expect(syncing.columns[0].secondaryText).toContain('50');
          expect(
            syncing.columns[0].secondaryTextSegments
              ?.map((segment) => segment.text)
              .join(''),
          ).toBe(syncing.columns[0].secondaryText);
          expect(syncing.style?.lineGap).toBe(0);
          expect(syncing.accessibilityLabel).toBe(
            [
              'XMR',
              'Syncing',
              syncing.columns[0].secondaryText,
              syncing.columns[1].text,
              syncing.columns[1].secondaryText,
            ].join(', '),
          );
        }
        expect(syncing.columns[1].text).toBe('2');
        expect(syncing.columns[1].secondaryText).toContain('100');
        expect(syncing.trailing).toEqual([{ kind: 'spinner' }]);
      }
      validateInstalledSnapshot(mockSnapshot!);
      fireEvent.click(getByTestId(token.$key));
      expect(onPressToken).toHaveBeenCalledWith(token);

      rerender(
        <NativeTokenSelectorList
          {...props}
          nativeTokenStatus={{ ...status, label: 'Paused', loading: false }}
        />,
      );
      const paused = mockSnapshot?.rows[0];
      if (paused?.type === 'identity' || paused?.type === 'dataRow') {
        expect(paused.trailing).not.toContainEqual({ kind: 'spinner' });
      }
      if (isNative && paused?.type === 'dataRow') {
        expect(paused.height).toBe(60);
        expect(paused.accessibilityLabel).toContain('Paused');
        expect(paused.accessibilityLabel).not.toContain('Syncing');
        expect(paused.columns[1]).toEqual(
          syncing?.type === 'dataRow' ? syncing.columns[1] : undefined,
        );
      }
      validateInstalledSnapshot(mockSnapshot!);

      rerender(<NativeTokenSelectorList {...props} />);
      const synced = mockSnapshot?.rows[0];
      if (synced?.type === 'identity') {
        expect(synced.badges).toEqual([]);
      } else if (synced?.type === 'dataRow') {
        expect(synced.columns[0].secondaryText).toBe('Monero');
      }
      validateInstalledSnapshot(mockSnapshot!);

      for (const extra of [
        { isAllNetworks: true },
        { isTokenSelector: true },
        { networkId: 'evm--1' },
      ]) {
        rerender(
          <NativeTokenSelectorList
            {...props}
            {...extra}
            nativeTokenStatus={status}
          />,
        );
        const unrelated = mockSnapshot?.rows[0];
        if (unrelated?.type === 'identity' || unrelated?.type === 'dataRow') {
          expect(unrelated.trailing).not.toContainEqual({ kind: 'spinner' });
        }
      }
    } finally {
      platformEnv.isNative = wasNative;
      mockRowLayoutEngine = 'web';
    }
  },
);

it('passes disclosure content and toggle through the Web adapter', () => {
  const wasNative = platformEnv.isNative;
  platformEnv.isNative = false;
  const content = <div>Expanded content</div>;
  const toggle = <div>Show less</div>;
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
        expandedContent={content}
        structureToggle={toggle}
      />,
    );
  } finally {
    platformEnv.isNative = wasNative;
  }
  expect(mockExpandedContent).toBe(content);
  expect(mockStructureToggle).toBe(toggle);
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
    // The 60dp row must round to the nearest pixel: Android's legacy sub-400dp
    // 0.9 row scale clipped the subtitle under the unscaled line boxes (OK-66072).
    expect(ethRow).toMatchObject({ height: 60, heightRounding: 'nearest' });
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
    expect(first).toMatchObject({ height: 60, heightRounding: 'nearest' });
    expect(first.style?.container?.cornerRadius).toBe(12);
    expect(first.columns.map(({ key, weight }) => ({ key, weight }))).toEqual([
      { key: 'asset', weight: 2 },
      { key: 'balance', weight: 3 },
      { key: 'price', weight: 3 },
      { key: 'swapSpacer', weight: 2 },
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

it('rounds the Web row box for its hover fill and leaves native rows to the engine', () => {
  const props = {
    rows: [ethToken],
    networkId: 'evm--1',
    crossNetworkGroupingActive: false,
    zeroFillMissingFiat: false,
    showProcessingState: false,
    isSearching: false,
    currentNetworkName: 'Ethereum',
    empty: <div />,
  };
  const renderFirstRow = (
    engine: typeof mockRowLayoutEngine,
    tableLayout: boolean,
  ) => {
    mockRowLayoutEngine = engine;
    const { unmount } = render(
      <NativeTokenSelectorList {...props} tableLayout={tableLayout} />,
    );
    const row = mockSnapshot?.rows[0];
    unmount();
    return {
      type: row?.type,
      container:
        row?.type === 'identity' || row?.type === 'dataRow'
          ? row.style?.container
          : undefined,
    };
  };
  try {
    for (const tableLayout of [false, true]) {
      const type = tableLayout ? 'dataRow' : 'identity';
      expect(renderFirstRow('web', tableLayout)).toEqual({
        type,
        container: { cornerRadius: 12 },
      });
      expect(renderFirstRow('native', tableLayout)).toEqual({
        type,
        container: undefined,
      });
    }
  } finally {
    mockRowLayoutEngine = 'web';
  }
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
  const initialSnapshot = mockSnapshotProps.at(-1)!;
  const unchangedRow = getMockSnapshot()?.rows[500];
  mockApplyPatches.mockClear();
  jest.mocked(formatNativeSelectorAmount).mockClear();
  const stringifySpy = jest.spyOn(JSON, 'stringify');
  try {
    expect(planNativeListPatches(initialSnapshot, initialSnapshot)).toEqual([]);
    expect(stringifySpy).not.toHaveBeenCalled();
  } finally {
    stringifySpy.mockRestore();
  }
  rerender(<NativeTokenSelectorList {...props} tokenListMap={initialFiat} />);
  expect(mockSnapshotProps.at(-1)).toBe(initialSnapshot);
  expect(mockApplyPatches).not.toHaveBeenCalled();
  expect(formatNativeSelectorAmount).not.toHaveBeenCalled();
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
  mockApplyPatches.mockClear();
  rerender(
    <NativeTokenSelectorList
      {...props}
      rows={[...rows].toReversed()}
      tokenListMap={updatedFiat}
    />,
  );
  expect(mockSnapshotProps.at(-1)).not.toBe(initialSnapshot);
  expect(mockApplyPatches).not.toHaveBeenCalled();
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
    const beforeTheme = mockSnapshotProps.at(-1);
    mockApplyPatches.mockClear();
    mockTheme = { ...mockTheme, background: '#101010' };
    rerender(<NativeTokenSelectorList {...props} tokenListMap={fiat} />);
    expect(mockSnapshot?.theme?.background).toBe('#101010');
    expect(mockSnapshot?.rows[0]).not.toBe(afterLocale);
    expect(mockSnapshotProps.at(-1)).not.toBe(beforeTheme);
    expect(mockApplyPatches).not.toHaveBeenCalled();

    const beforeOwner = mockSnapshotProps.at(-1);
    mockApplyPatches.mockClear();
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
    expect(mockApplyPatches).not.toHaveBeenCalled();
  } finally {
    mockProcessingTokenState = { isProcessing: false, token: null };
    mockCurrencyId = 'usd';
    mockIntl = { formatMessage: ({ id }: { id: string }) => id };
    mockTheme = { ...mockTheme, background: '#FFFFFF' };
  }
});

it('fills a first-mount Home row from its cell before the mirror reports', () => {
  // The mirrors publish cell values from a layout effect, so the snapshot
  // built in the same render as a row's first mount used to carry no fiat
  // (OK-66042). The row must read its cell directly on that first pass.
  const store = createStore() as unknown as IJotaiContextStore;
  const fiat = {
    balanceParsed: '0.414',
    balanceMultiplier: '1000',
    fiatValue: '0.41',
    price: 1.5,
    price24h: 5.5,
    currency: 'usd',
  } as ITokenFiat;
  store.set(cell(store, ethToken.$key), fiat);
  mockHomeCellStore = store;
  // Mirrors report nothing for this key (no cell hook value), so only the
  // direct store read can fill the first snapshot.
  mockHomeFiatMap = {};
  const firstIndex = mockSnapshotProps.length;
  try {
    render(
      <NativeTokenSelectorList
        rows={[ethToken]}
        networkId="evm--1"
        ownerKey="owner-A"
        crossNetworkGroupingActive={false}
        zeroFillMissingFiat={false}
        showProcessingState={false}
        isSearching={false}
        currentNetworkName="Ethereum"
        empty={<div />}
        homeCellSeam
        tableLayout
        withPrice
        withSwapAction
      />,
    );
    const first = mockSnapshotProps[firstIndex]?.rows[0];
    expect(first?.type).toBe('dataRow');
    if (first?.type === 'dataRow') {
      expect(first.columns[1].text).toBe('414');
      expect(first.columns[1].secondaryText).toContain('0.41');
      expect(first.columns[2].text).toContain('1.5');
    }
  } finally {
    mockHomeCellStore = undefined;
    mockHomeFiatMap = {};
  }
});
