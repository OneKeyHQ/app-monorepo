/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AssetListTestIDs } from '../testIDs';

import { RiskNativeList } from './RiskTokenManager';

import type {
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';

let mockSnapshot: NativeListSnapshot | undefined;
let mockRowAction: ((event: RowActionEvent) => void) | undefined;
let mockAnchorInvalidated:
  | ((event: { token: string; reason: 'snapshot' }) => void)
  | undefined;
let mockMeasureCallback: ((x: number, y: number) => void) | undefined;
const mockSetActionAnchorState = jest.fn();
const mockClick = jest.spyOn(defaultLogger.ui.button, 'click');
const mockNetworksMap: Record<
  string,
  { isCustomNetwork: boolean; logoURI?: string; name?: string }
> = {
  all: { isCustomNetwork: false },
  'evm--1': {
    isCustomNetwork: false,
    logoURI: 'https://example.com/network.png',
  },
};
const mockTheme = Object.fromEntries(
  [
    'bgApp',
    'bgActive',
    'bgSubdued',
    'bgStrong',
    'bgStrongActive',
    'bgStrongHover',
    'bgHover',
    'text',
    'textSubdued',
    'textInverse',
    'icon',
    'iconSubdued',
    'iconActive',
    'borderSubdued',
    'textSuccess',
    'textCritical',
    'bgInverse',
    'neutral6Dark',
    'neutral2Dark',
    'gray5',
    'focusRing',
  ].map((key) => [key, { val: '#123456' }]),
);

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: jest.requireActual<typeof import('react')>('react').forwardRef(
    (
      {
        snapshot,
        onRowAction,
        onActionAnchorInvalidated,
      }: {
        snapshot: NativeListSnapshot;
        onRowAction: (event: RowActionEvent) => void;
        onActionAnchorInvalidated: (event: {
          token: string;
          reason: 'snapshot';
        }) => void;
      },
      ref: import('react').ForwardedRef<unknown>,
    ) => {
      jest
        .requireActual<typeof import('react')>('react')
        .useImperativeHandle(ref, () => ({
          setActionAnchorState: mockSetActionAnchorState,
        }));
      mockSnapshot = snapshot;
      mockRowAction = onRowAction;
      mockAnchorInvalidated = onActionAnchorInvalidated;
      return <div data-testid="native-list" />;
    },
  ),
  validateSnapshot: (snapshot: NativeListSnapshot) => snapshot,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { button: { click: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAggregateNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'all',
    getLocalNetworkInfo: () => undefined,
  },
}));
jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'dark',
}));
jest.mock(
  '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext',
  () => ({
    useTokenListViewContext: () => ({
      networksMap: mockNetworksMap,
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList', () => ({
  withTokenListProvider: (component: unknown) => component,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceNetwork: { getNetwork: jest.fn() } },
}));
jest.mock('@onekeyhq/kit/src/components/Empty', () => ({
  EmptySearch: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItem = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return { ListItem };
});
jest.mock('@onekeyhq/kit/src/components/TokenListView/TokenIconView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TokenListView/TokenNameView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Wrap = ({ children }: PropsWithChildren) => <div>{children}</div>;
  const Stack = React.forwardRef<unknown, PropsWithChildren>(
    ({ children }, ref) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: (x: number, y: number) => void) => {
          mockMeasureCallback = callback;
        },
      }));
      return <div>{children}</div>;
    },
  );
  Stack.displayName = 'MockStack';
  return {
    Alert: Wrap,
    Button: Wrap,
    LazyTooltip: ({ open }: { open: boolean }) =>
      open ? <div data-testid="native-tooltip" /> : null,
    Page: Wrap,
    SectionList: Wrap,
    Stack,
    Toast: { success: jest.fn() },
    XStack: Wrap,
    YStack: Wrap,
    useTheme: () => mockTheme,
    useMedia: () => ({ gtMd: false }),
  };
});

const token = {
  $key: 'risk-token',
  networkId: 'evm--1',
  accountId: 'account-a',
  address: '0xabc',
  symbol: 'RISK',
  name: 'Risk token',
  logoURI: 'https://example.com/token.png',
  isBlocked: true,
  isNative: true,
} as IAccountToken & { isBlocked: boolean };

function renderRisk(isEditing: boolean, onToggleToken = jest.fn()) {
  return render(
    <RiskNativeList
      sections={[
        { key: 'visible', title: 'Visible', data: [] },
        { key: 'collapsed', title: 'Collapsed', data: [token] },
      ]}
      networkId="evm--1"
      isAllNetworks={false}
      isEditing={isEditing}
      unblockedTokensMap={{}}
      blockedTokensMap={{ 'evm--1': { '0xabc': true } }}
      customTokensMap={{}}
      onPressToken={jest.fn()}
      onToggleToken={onToggleToken}
    />,
  );
}

beforeEach(() => {
  mockSnapshot = undefined;
  mockRowAction = undefined;
  mockAnchorInvalidated = undefined;
  mockMeasureCallback = undefined;
  mockSetActionAnchorState.mockClear();
  mockClick.mockClear();
});

it('serializes Risk geometry and gates stale button actions after edit closes', () => {
  const onToggle = jest.fn();
  const view = renderRisk(true, onToggle);
  const rows = mockSnapshot!.rows;
  expect(rows.find((row) => row.key === 'gap:risk:collapsed')).toMatchObject({
    type: 'system',
    height: 20,
  });
  const identity = rows.find((row) => row.type === 'identity')!;
  expect(identity).toMatchObject({
    height: 56,
    leading: {
      fallbackIcon: {
        name: 'CryptoCoinOutline',
        size: 28,
        backgroundColor: '#123456',
      },
      borderColor: '#123456',
    },
    titleIcon: { name: 'GasSolid' },
    style: { leadingContentMaxWidthRatio: 0.6 },
    trailing: [{ kind: 'button', actionKey: 'show' }],
  });
  const priorCallback = mockRowAction!;
  act(() => priorCallback({ rowKey: identity.key, actionKey: 'show' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(mockClick).toHaveBeenCalledTimes(1);
  expect(mockClick).toHaveBeenCalledWith({
    trackId: AssetListTestIDs.riskTokenToggleBtn,
  });
  view.rerender(
    <RiskNativeList
      sections={[{ key: 'collapsed', title: 'Collapsed', data: [token] }]}
      networkId="evm--1"
      isAllNetworks={false}
      isEditing={false}
      unblockedTokensMap={{}}
      blockedTokensMap={{ 'evm--1': { '0xabc': true } }}
      customTokensMap={{}}
      onPressToken={jest.fn()}
      onToggleToken={onToggle}
    />,
  );
  act(() => priorCallback({ rowKey: identity.key, actionKey: 'show' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(mockClick).toHaveBeenCalledTimes(1);
  view.unmount();
  act(() => priorCallback({ rowKey: identity.key, actionKey: 'press' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it('opens Gas help only for the current native token and rejects stale anchors', () => {
  const onPress = jest.fn();
  const onToggle = jest.fn();
  const props: ComponentProps<typeof RiskNativeList> = {
    sections: [{ key: 'collapsed', title: 'Collapsed', data: [token] }],
    networkId: 'evm--1',
    isAllNetworks: false,
    isEditing: false,
    unblockedTokensMap: {},
    blockedTokensMap: {},
    customTokensMap: {},
    onPressToken: onPress,
    onToggleToken: onToggle,
  };
  const view = render(<RiskNativeList {...props} />);
  const rowKey = mockSnapshot!.rows.find((row) => row.type === 'identity')!.key;
  const anchor = (name: string) => ({
    token: name,
    source: 'leadingAction' as const,
    generation: 1,
    layoutDirection: 'ltr' as const,
    windowRect: { x: 20, y: 30, width: 20, height: 20 },
  });
  expect(
    mockSnapshot!.rows.find((row) => row.type === 'identity'),
  ).toMatchObject({
    titleIcon: { hoverActionKey: 'native-token-info' },
  });
  act(() =>
    mockRowAction!({
      rowKey,
      actionKey: 'native-token-info',
      anchor: { ...anchor('wrong-source'), source: 'trailingAccessory' },
    }),
  );
  expect(mockMeasureCallback).toBeUndefined();
  act(() =>
    mockRowAction!({
      rowKey,
      actionKey: 'native-token-info',
      anchor: anchor('gas-1'),
    }),
  );
  expect(mockSetActionAnchorState).toHaveBeenCalledWith({
    token: 'gas-1',
    open: true,
  });
  const firstMeasure = mockMeasureCallback!;
  act(() => firstMeasure(5, 10));
  expect(view.queryByTestId('native-tooltip')).not.toBeNull();
  act(() => mockAnchorInvalidated!({ token: 'gas-1', reason: 'snapshot' }));
  expect(view.queryByTestId('native-tooltip')).toBeNull();
  act(() => firstMeasure(5, 10));
  expect(view.queryByTestId('native-tooltip')).toBeNull();
  act(() =>
    mockRowAction!({
      rowKey,
      actionKey: 'native-token-info',
      anchor: anchor('gas-2'),
    }),
  );
  const secondMeasure = mockMeasureCallback!;
  view.rerender(<RiskNativeList {...props} sections={[]} />);
  act(() => secondMeasure(5, 10));
  expect(view.queryByTestId('native-tooltip')).toBeNull();
  act(() =>
    mockRowAction!({
      rowKey,
      actionKey: 'native-token-info',
      anchor: anchor('removed'),
    }),
  );
  expect(mockSetActionAnchorState).not.toHaveBeenCalledWith({
    token: 'removed',
    open: true,
  });
  view.rerender(<RiskNativeList {...props} />);
  act(() =>
    mockRowAction!({
      rowKey,
      actionKey: 'native-token-info',
      anchor: anchor('gas-3'),
    }),
  );
  const unmountMeasure = mockMeasureCallback!;
  view.unmount();
  act(() => unmountMeasure(5, 10));
  expect(onPress).not.toHaveBeenCalled();
  expect(onToggle).not.toHaveBeenCalled();
  expect(mockClick).not.toHaveBeenCalled();
});

it('normalizes invalid native fields and skips duplicate row keys', () => {
  const malformed = {
    ...token,
    $key: 'x'.repeat(300),
    symbol: null,
    logoURI: 'x'.repeat(5000),
  } as unknown as typeof token;
  render(
    <RiskNativeList
      sections={[
        {
          key: 'collapsed',
          title: 'x'.repeat(5000),
          data: [malformed, malformed],
        },
      ]}
      networkId="evm--1"
      isAllNetworks={false}
      isEditing={false}
      unblockedTokensMap={{}}
      blockedTokensMap={{}}
      customTokensMap={{}}
      onPressToken={jest.fn()}
      onToggleToken={jest.fn()}
    />,
  );
  const rows = mockSnapshot!.rows;
  expect(rows.filter((row) => row.type === 'identity')).toHaveLength(1);
  expect(rows.find((row) => row.type === 'identity')).toMatchObject({
    title: '',
    leading: { image: undefined },
  });
  expect(rows.find((row) => row.type === 'identity')?.key).toContain('0xabc');
  expect(rows.find((row) => row.type === 'sectionHeader')?.title.length).toBe(
    4096,
  );
});

it('resolves custom network metadata before serializing the letter badge', async () => {
  const customToken = { ...token, networkId: 'custom--1', isNative: false };
  const getNetwork = jest.spyOn(
    backgroundApiProxy.serviceNetwork,
    'getNetwork',
  );
  getNetwork.mockResolvedValue({
    id: 'custom--1',
    isCustomNetwork: true,
    name: 'Aurora',
    logoURI: '',
  } as IServerNetwork);
  await act(async () => {
    render(
      <RiskNativeList
        sections={[
          { key: 'collapsed', title: 'Collapsed', data: [customToken] },
        ]}
        networkId="all"
        isAllNetworks
        isEditing={false}
        unblockedTokensMap={{}}
        blockedTokensMap={{}}
        customTokensMap={{}}
        onPressToken={jest.fn()}
        onToggleToken={jest.fn()}
      />,
    );
  });
  expect(getNetwork).toHaveBeenCalledWith({ networkId: 'custom--1' });
  expect(
    mockSnapshot!.rows.find((row) => row.type === 'identity'),
  ).toMatchObject({
    leading: {
      overlays: [
        { size: 20, backgroundColor: '#123456' },
        { size: 16, text: 'A', fontWeight: 'semibold' },
      ],
    },
  });
});
