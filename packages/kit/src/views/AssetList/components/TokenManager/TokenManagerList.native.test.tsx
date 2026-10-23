/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

import { AssetListTestIDs } from '../../testIDs';

import { TokenManagerList } from './TokenManagerList';

import type {
  ActionAnchorInvalidatedEvent,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';

let mockIsNative = true;
let mockSnapshot: NativeListSnapshot | undefined;
let mockRowAction: ((event: RowActionEvent) => void) | undefined;
let mockAnchorInvalidated:
  | ((event: ActionAnchorInvalidatedEvent) => void)
  | undefined;
let mockLegacyRendered = false;
const mockSetActionAnchorState = jest.fn();
const mockButtonClick = jest.spyOn(defaultLogger.ui.button, 'click');

const mockTheme = Object.fromEntries(
  [
    'bgApp',
    'bgActive',
    'bgHover',
    'bgSubdued',
    'bgStrong',
    'text',
    'textSubdued',
    'textDisabled',
    'icon',
    'iconSubdued',
    'iconCritical',
    'borderSubdued',
    'iconActive',
    'focusRing',
    'textSuccess',
    'textCritical',
    'bgInverse',
    'textInverse',
    'neutral6Dark',
    'neutral2Dark',
    'gray5',
  ].map((key) => [key, { val: '#123456' }]),
);

jest.mock('@onekeyfe/react-native-native-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeList: React.forwardRef<
      Pick<NativeListRef, 'setActionAnchorState'>,
      {
        snapshot: NativeListSnapshot;
        onRowAction: (event: RowActionEvent) => void;
        onActionAnchorInvalidated: (
          event: ActionAnchorInvalidatedEvent,
        ) => void;
        listHeader: ReactNode;
        listFooter: ReactNode;
        listEmpty: ReactNode;
      }
    >(function MockNativeList(
      {
        snapshot,
        onRowAction,
        onActionAnchorInvalidated,
        listHeader,
        listFooter,
        listEmpty,
      },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({
        setActionAnchorState: mockSetActionAnchorState,
      }));
      mockSnapshot = snapshot;
      mockRowAction = onRowAction;
      mockAnchorInvalidated = onActionAnchorInvalidated;
      return (
        <div data-testid="native-list">
          {listHeader}
          {snapshot.rows.length === 0 ? listEmpty : null}
          {listFooter}
        </div>
      );
    }),
    validateSnapshot: (snapshot: NativeListSnapshot) => snapshot,
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  get isNative() {
    return mockIsNative;
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { button: { click: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isBTCNetwork: (networkId: string) => networkId === 'btc--0',
    isAggregateNetwork: () => false,
    getLocalNetworkInfo: () => undefined,
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock(
  '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext',
  () => ({
    useTokenListViewContext: () => ({
      allAggregateTokenMap: {},
      ownedAggregateTokenListMap: {},
      networksMap: undefined,
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/components/TokenListView/TokenIconView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItem = ({ children }: PropsWithChildren) => <div>{children}</div>;
  ListItem.IconButton = () => null;
  return { ListItem };
});
jest.mock('@onekeyhq/components', () => {
  const Wrap = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Badge: Wrap,
    Button: Wrap,
    Divider: Wrap,
    Empty: ({ title }: { title: string }) => (
      <div data-testid="empty">{title}</div>
    ),
    LazyTooltip: ({ renderContent }: { renderContent: ReactNode }) => (
      <div data-testid="token-tooltip">{renderContent}</div>
    ),
    SectionList: () => {
      mockLegacyRendered = true;
      return <div data-testid="legacy-list" />;
    },
    SizableText: Wrap,
    Skeleton: Wrap,
    Stack: Wrap,
    XStack: Wrap,
    YStack: Wrap,
    useSafeAreaInsets: () => ({ bottom: 0 }),
    useMedia: () => ({ gtMd: false }),
    useTheme: () => mockTheme,
  };
});

const token: ICustomTokenItem = {
  $key: 'evm--1_0x123',
  accountId: 'account-a',
  networkId: 'evm--1',
  address: '0x123',
  name: 'Example token',
  symbol: 'EX',
  decimals: 18,
  isNative: false,
  logoURI: 'https://example.com/token.png',
};

const actionAnchor: NativeListActionAnchor = {
  token: 'action-anchor',
  windowRect: { x: 10, y: 20, width: 24, height: 24 },
  source: 'trailingAccessory',
  slot: 0,
  generation: 1,
  layoutDirection: 'ltr',
};

function renderList({
  sections = [{ title: 'Added', data: [token] }],
  check = () => undefined,
  onAdd = jest.fn(),
  onHide = jest.fn().mockResolvedValue(undefined),
  isAllNetwork = false,
  networkMaps = {},
}: {
  sections?: { title: string; data: ICustomTokenItem[] }[];
  check?: (item: ICustomTokenItem) => ICustomTokenItem | undefined;
  onAdd?: jest.Mock;
  onHide?: jest.Mock;
  isAllNetwork?: boolean;
  networkMaps?: Record<string, IServerNetwork>;
} = {}) {
  return render(
    <TokenManagerList
      dataSource={sections}
      onAddCustomToken={onAdd}
      onHiddenToken={onHide}
      isLoadingRemoteData={false}
      networkId="evm--1"
      isAllNetwork={isAllNetwork}
      networkMaps={networkMaps}
      checkTokenExistInTokenList={check}
      searchValue=""
      searchResult={null}
    />,
  );
}

async function serializeWithInstalledSdk(snapshot: NativeListSnapshot) {
  const { execFileSync } = await import('node:child_process');
  const { createRequire } = await import('node:module');
  const path = await import('node:path');
  const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const packageDir = path.dirname(
    nodeRequire.resolve('@onekeyfe/react-native-native-list/package.json'),
  );
  const validatorPath = path.join(packageDir, 'lib/module/validation.js');
  const script = `
    const { pathToFileURL } = await import('node:url');
    globalThis.__DEV__ = true;
    const validator = await import(pathToFileURL(process.argv[1]).href);
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const snapshot = JSON.parse(input);
    validator.validateSnapshot(snapshot);
    process.stdout.write(validator.serializeSnapshot(snapshot));
  `;
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script, validatorPath],
    { input: JSON.stringify(snapshot), encoding: 'utf8' },
  );
}

beforeEach(() => {
  mockIsNative = true;
  mockSnapshot = undefined;
  mockRowAction = undefined;
  mockAnchorInvalidated = undefined;
  mockLegacyRendered = false;
  mockButtonClick.mockClear();
  mockSetActionAnchorState.mockClear();
});

it('keeps the empty added section before hidden tokens and serializes its rows', async () => {
  renderList({
    sections: [
      { title: 'Added', data: [] },
      { title: 'Hidden', data: [token] },
    ],
  });

  expect(screen.getByTestId('native-list').textContent).toContain('Added');
  expect(screen.getByTestId('empty')).toBeTruthy();
  expect(mockSnapshot?.theme).toBeDefined();
  expect(mockSnapshot?.theme?.rowHoverBackground).toBeUndefined();
  expect(mockSnapshot?.layout).toMatchObject({
    kind: 'sectioned',
    stickyHeaders: false,
    contentPaddingHorizontal: 8,
  });
  expect(mockSnapshot?.rows.map((row) => row.type)).toEqual([
    'system',
    'sectionHeader',
    'identity',
  ]);
  expect(mockSnapshot?.rows[0]).toMatchObject({
    variant: 'spacer',
    height: 20,
  });
  expect(mockSnapshot?.rows[1]).toMatchObject({
    style: { title: { fontWeight: 'regular' } },
  });
  expect(mockSnapshot?.rows[2]).toMatchObject({
    title: 'EX',
    subtitle: 'Example token',
    height: 60,
    pressDisabled: true,
    leading: {
      fallbackIcon: { size: 28, backgroundColor: '#123456' },
    },
    trailing: [{ buttonStyle: 'tertiary' }],
  });
  const serialized = await serializeWithInstalledSdk(mockSnapshot!);
  expect(JSON.parse(serialized)).toMatchObject({ schemaVersion: 1 });
});

it('keeps the added title with a fully empty list', async () => {
  renderList({ sections: [{ title: 'Added', data: [] }] });
  expect(screen.getByTestId('native-list').textContent).toContain('Added');
  expect(screen.getAllByTestId('empty')).toHaveLength(1);
  expect(mockSnapshot?.rows).toHaveLength(0);
  await expect(serializeWithInstalledSdk(mockSnapshot!)).resolves.toContain(
    '"rows":[]',
  );
});

it('keeps valid peers when a token has malformed display data', async () => {
  const malformedToken = {
    ...token,
    $key: 'malformed',
    address: '0xmalformed',
    logoURI: '   ',
    name: null,
    symbol: 42,
  } as unknown as ICustomTokenItem;
  const longToken = {
    ...token,
    $key: 'long',
    address: '0xlong',
    symbol: `${'A'.repeat(4095)}😀extra`,
  };
  renderList({
    sections: [{ title: 'Added', data: [malformedToken, longToken] }],
  });
  const identityRows = mockSnapshot?.rows.filter(
    (row) => row.type === 'identity',
  );
  expect(identityRows).toHaveLength(2);
  expect(identityRows?.[0]).toMatchObject({ title: '', subtitle: '' });
  const firstRow = identityRows?.[0];
  expect(
    firstRow?.type === 'identity' && firstRow.leading.kind === 'token'
      ? firstRow.leading.image
      : undefined,
  ).toBeUndefined();
  expect(
    identityRows?.[1]?.type === 'identity' && identityRows[1].title,
  ).toHaveLength(4095);
  await expect(serializeWithInstalledSdk(mockSnapshot!)).resolves.toContain(
    'schemaVersion',
  );
});

it('preserves the custom network letter and badge in a serializable row', async () => {
  renderList({
    isAllNetwork: true,
    networkMaps: {
      'evm--1': {
        id: 'evm--1',
        name: 'my network',
        logoURI: '',
        isCustomNetwork: true,
      } as IServerNetwork,
    },
  });
  const row = mockSnapshot?.rows.find((item) => item.type === 'identity');
  expect(row).toMatchObject({
    badges: [{ text: 'my network', tone: 'neutral' }],
    leading: {
      overlays: [
        { size: 20, offset: 4 },
        { size: 16, offset: 2, text: 'M', fontWeight: 'semibold' },
      ],
    },
  });
  await expect(serializeWithInstalledSdk(mockSnapshot!)).resolves.toContain(
    'my network',
  );
});

it('uses the bordered network overlay and its icon fallback with a token logo', async () => {
  renderList({
    isAllNetwork: true,
    networkMaps: {
      'evm--1': {
        id: 'evm--1',
        name: 'Example network',
        logoURI: 'https://example.com/network.png',
      } as IServerNetwork,
    },
  });
  const row = mockSnapshot?.rows.find((item) => item.type === 'identity');
  expect(row).toMatchObject({
    leading: {
      overlays: [
        {
          size: 20,
          padding: 2,
          offset: 4,
          image: { uri: 'https://example.com/network.png' },
          fallbackIcon: { name: 'GlobusOutline' },
        },
      ],
    },
  });
  expect(row).not.toHaveProperty('leading.networkImage');
  await expect(serializeWithInstalledSdk(mockSnapshot!)).resolves.toContain(
    'GlobusOutline',
  );
});

it('serializes a network backdrop without a logo or image fallback', async () => {
  renderList({ isAllNetwork: true });
  const row = mockSnapshot?.rows.find((item) => item.type === 'identity');
  expect(row).toMatchObject({
    leading: {
      overlays: [{ size: 20, padding: 2, offset: 4 }],
    },
  });
  expect(row).toHaveProperty('leading.overlays.0.image', undefined);
  expect(row).toHaveProperty('leading.overlays.0.fallbackIcon', undefined);
  await expect(serializeWithInstalledSdk(mockSnapshot!)).resolves.toContain(
    'schemaVersion',
  );
});

it('accepts only current token actions and blocks repeated or disabled actions', () => {
  const onAdd = jest.fn(() => new Promise<void>(() => {}));
  const onHide = jest.fn().mockResolvedValue(undefined);
  const check = jest.fn(() => undefined as ICustomTokenItem | undefined);
  const { rerender } = renderList({ onAdd, onHide, check });
  const key = mockSnapshot?.rows.find((row) => row.type === 'identity')?.key;
  expect(key).toBeDefined();

  act(() => {
    mockRowAction?.({ rowKey: 'unknown', actionKey: 'add' });
    mockRowAction?.({ rowKey: key, actionKey: 'hide' });
    mockRowAction?.({ rowKey: key, actionKey: 'add' });
    mockRowAction?.({ rowKey: key, actionKey: 'add' });
  });
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onHide).not.toHaveBeenCalled();
  expect(mockButtonClick).toHaveBeenCalledTimes(1);
  expect(mockButtonClick).toHaveBeenCalledWith({
    trackId: AssetListTestIDs.tokenManagerToggleBtn,
  });

  const btcToken = { ...token, networkId: 'btc--0' };
  check.mockReturnValue(btcToken);
  rerender(
    <TokenManagerList
      dataSource={[{ title: 'Added', data: [btcToken] }]}
      onAddCustomToken={onAdd}
      onHiddenToken={onHide}
      isLoadingRemoteData={false}
      networkId="btc--0"
      isAllNetwork={false}
      networkMaps={{}}
      checkTokenExistInTokenList={check}
      searchValue=""
      searchResult={null}
    />,
  );
  const btcKey = mockSnapshot?.rows.find((row) => row.type === 'identity')?.key;
  expect(
    mockSnapshot?.rows.find((row) => row.type === 'identity'),
  ).toMatchObject({
    trailing: [{ actionKey: 'hide', disabled: true }],
  });
  act(() => {
    mockRowAction?.({ rowKey: btcKey, actionKey: 'hide' });
    mockRowAction?.({ rowKey: key, actionKey: 'add' });
  });
  expect(onHide).not.toHaveBeenCalled();
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(mockButtonClick).toHaveBeenCalledTimes(1);
});

it('shows BTC help on DOM hover without enabling or tracking the action', () => {
  mockIsNative = false;
  const btcToken = { ...token, networkId: 'btc--0' };
  const check = jest.fn(() => btcToken as ICustomTokenItem | undefined);
  const onAdd = jest.fn();
  const onHide = jest.fn();
  const { rerender } = renderList({
    sections: [{ title: 'Added', data: [btcToken] }],
    check,
    onAdd,
    onHide,
  });
  const row = mockSnapshot?.rows.find((item) => item.type === 'identity');
  expect(row).toMatchObject({
    trailing: [
      { disabled: true, actionKey: 'hide', hoverActionKey: 'cannot-remove' },
    ],
  });
  act(() => {
    mockRowAction?.({
      rowKey: row?.key,
      actionKey: 'cannot-remove',
      anchor: { ...actionAnchor, source: 'row' },
    });
  });
  expect(screen.queryByTestId('token-tooltip')).toBeNull();
  act(() => {
    mockRowAction?.({
      rowKey: row?.key,
      actionKey: 'cannot-remove',
      anchor: actionAnchor,
    });
  });
  expect(screen.getByTestId('token-tooltip').textContent).toBe(
    ETranslations.manage_token_native_token_cannot_removed,
  );
  expect(mockSetActionAnchorState).toHaveBeenCalledWith({
    token: actionAnchor.token,
    open: true,
  });
  expect(onAdd).not.toHaveBeenCalled();
  expect(onHide).not.toHaveBeenCalled();
  expect(mockButtonClick).not.toHaveBeenCalled();

  act(() => {
    mockAnchorInvalidated?.({ token: actionAnchor.token, reason: 'scroll' });
  });
  expect(screen.queryByTestId('token-tooltip')).toBeNull();
  expect(mockSetActionAnchorState).toHaveBeenCalledWith({
    token: actionAnchor.token,
    open: false,
    restoreFocus: true,
  });

  act(() => {
    mockRowAction?.({
      rowKey: row?.key,
      actionKey: 'cannot-remove',
      anchor: actionAnchor,
    });
  });
  expect(screen.getByTestId('token-tooltip')).toBeTruthy();
  check.mockReturnValue(undefined);
  rerender(
    <TokenManagerList
      dataSource={[{ title: 'Added', data: [btcToken] }]}
      onAddCustomToken={onAdd}
      onHiddenToken={onHide}
      isLoadingRemoteData={false}
      networkId="btc--0"
      isAllNetwork={false}
      networkMaps={{}}
      checkTokenExistInTokenList={check}
      searchValue=""
      searchResult={null}
    />,
  );
  expect(screen.queryByTestId('token-tooltip')).toBeNull();
  act(() => {
    mockRowAction?.({
      rowKey: row?.key,
      actionKey: 'cannot-remove',
      anchor: actionAnchor,
    });
  });
  expect(screen.queryByTestId('token-tooltip')).toBeNull();
  expect(onAdd).not.toHaveBeenCalled();
  expect(onHide).not.toHaveBeenCalled();
  expect(mockButtonClick).not.toHaveBeenCalled();
});

it('ignores a native action delivered after the modal unmounts', () => {
  const onAdd = jest.fn();
  const { unmount } = renderList({ onAdd });
  const key = mockSnapshot?.rows.find((row) => row.type === 'identity')?.key;
  const oldRowAction = mockRowAction;
  unmount();
  oldRowAction?.({ rowKey: key, actionKey: 'add' });
  expect(onAdd).not.toHaveBeenCalled();
});

it('uses NativeList on DOM targets', () => {
  mockIsNative = false;
  renderList();
  expect(screen.getByTestId('native-list')).toBeTruthy();
  expect(mockLegacyRendered).toBe(false);
  expect(mockSnapshot?.rows).toHaveLength(2);
  expect(mockSnapshot?.theme).toBeDefined();
  expect(mockSnapshot?.theme?.rowHoverBackground).toBe('#123456');
});

it('keeps rows with no stable key in the existing list', () => {
  const missingKeyToken = {
    ...token,
    $key: '',
    address: '',
  };
  renderList({ sections: [{ title: 'Added', data: [missingKeyToken] }] });
  expect(screen.getByTestId('legacy-list')).toBeTruthy();
  expect(mockSnapshot).toBeUndefined();
});
