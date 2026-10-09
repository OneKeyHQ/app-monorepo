/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapTabSwitchType,
  type ISwapAlertState,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapAlertsAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';

import { useSwapActionState } from './useSwapState';

import type { useSwapAddressInfo } from './useSwapAccount';

type ISwapAddressInfo = ReturnType<typeof useSwapAddressInfo>;
type IUnsupportedContext = NonNullable<
  ISwapAlertState['accountNetworkUnsupportedContext']
>;

let mockFromAddressInfo: ISwapAddressInfo;
let mockToAddressInfo: ISwapAddressInfo;
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
};
const mockInvalidateSwapWarningCheck = jest.fn();
const mockCheckSwapWarning = jest.fn();

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('../../../states/jotai/contexts/swap/actions', () => ({
  useSwapActions: () => ({
    current: {
      checkSwapWarning: mockCheckSwapWarning,
      invalidateSwapWarningCheck: mockInvalidateSwapWarningCheck,
    },
  }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [true],
  useIsAccountSelectorActiveAccountInitDone: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => false,
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: { wallets: [] }, isLoading: false }),
}));
jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms'),
  useSettingsAtom: () => [{ swapIncognitoMode: false }],
  useInAppNotificationAtom: () => [{ swapApprovingLoading: false }],
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: (direction: ESwapDirectionType) =>
    direction === ESwapDirectionType.TO
      ? mockToAddressInfo
      : mockFromAddressInfo,
}));

const payToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};
const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isNative: false,
  isStock: true,
};

function buildAccountInfo(
  accountId: string,
  walletId: string,
): IAccountSelectorActiveAccountInfo {
  const account: INetworkAccount = {
    id: accountId,
    name: accountId,
    type: undefined,
    path: "m/44'/60'/0'/0/0",
    coinType: '60',
    impl: 'evm',
    pub: '',
    address: `0x${accountId}`,
    addressDetail: {
      address: `0x${accountId}`,
      baseAddress: `0x${accountId}`,
      normalizedAddress: `0x${accountId}`,
      displayAddress: `0x${accountId}`,
      networkId: payToken.networkId,
      isValid: true,
      allowEmptyAddress: false,
    },
  };
  return {
    ready: true,
    account,
    indexedAccount: undefined,
    dbAccount: undefined,
    accountName: accountId,
    wallet: {
      id: walletId,
      name: walletId,
      type: 'hd',
      backuped: true,
      accounts: [],
      nextIds: {},
      walletNo: 1,
    },
    device: undefined,
    network: undefined,
    vaultSettings: undefined,
    deriveType: undefined,
    deriveInfoItems: [],
  };
}

const fromAccountInfo = buildAccountInfo('from-account', 'hd-1');
const toAccountInfo = buildAccountInfo('to-account', 'hd-2');

function buildUnsupportedAlert(
  directionType = ESwapDirectionType.FROM,
  context: Partial<IUnsupportedContext> = {},
  alertLevel = ESwapAlertLevel.ERROR,
): ISwapAlertState {
  const accountInfo =
    directionType === ESwapDirectionType.TO ? toAccountInfo : fromAccountInfo;
  return {
    message: 'Account does not support this network',
    alertLevel,
    isAccountNetworkUnsupported: true,
    accountNetworkUnsupportedContext: {
      accountId: accountInfo.account?.id,
      walletId: accountInfo.wallet?.id,
      networkId: payToken.networkId,
      directionType,
      ...context,
    },
  };
}

const ordinaryQuoteError: ISwapAlertState = {
  message: 'Provider error',
  alertLevel: ESwapAlertLevel.ERROR,
};

function createWrapper(alerts: ISwapAlertState[] = []) {
  const store = createStore();
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.STOCK);
  store.set(swapSelectFromTokenAtom(), payToken);
  store.set(swapSelectToTokenAtom(), stockToken);
  store.set(swapStockSelectedFromTokenBalanceAtom(), '0');
  store.set(swapAlertsAtom(), { states: alerts, quoteId: '' });

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  }
  return { store, Wrapper };
}

beforeEach(() => {
  globalJotaiStorageReadyHandler.resolveReady(true);
  jest.clearAllMocks();
  mockFromAddressInfo = {
    address: fromAccountInfo.account?.address,
    networkId: payToken.networkId,
    accountInfo: fromAccountInfo,
    activeAccount: fromAccountInfo,
    isAddressInfoReady: true,
  };
  mockToAddressInfo = {
    address: toAccountInfo.account?.address,
    networkId: stockToken.networkId,
    accountInfo: toAccountInfo,
    activeAccount: toAccountInfo,
    isAddressInfoReady: true,
  };
});

describe('useSwapActionState zero-balance deposit gate', () => {
  it.each([ESwapDirectionType.FROM, ESwapDirectionType.TO])(
    'does not override a current %s unsupported-account error when addresses exist',
    (directionType) => {
      const { Wrapper } = createWrapper([buildUnsupportedAlert(directionType)]);
      const { result } = renderHook(() => useSwapActionState(), {
        wrapper: Wrapper,
      });

      expect(result.current.shouldDepositToTrade).toBe(false);
      expect(result.current.disabled).toBe(true);
    },
  );

  it('finds the current unsupported-account error after an ordinary quote error', () => {
    const { Wrapper } = createWrapper([
      ordinaryQuoteError,
      buildUnsupportedAlert(),
    ]);
    const { result } = renderHook(() => useSwapActionState(), {
      wrapper: Wrapper,
    });

    expect(result.current.shouldDepositToTrade).toBe(false);
    expect(result.current.disabled).toBe(true);
  });

  it.each<Partial<IUnsupportedContext>>([
    { accountId: 'previous-account' },
    { walletId: 'previous-wallet' },
    { networkId: 'evm--1' },
    { directionType: ESwapDirectionType.TO },
  ])(
    'ignores an unsupported-account error with a stale %j context',
    (context) => {
      const { Wrapper } = createWrapper([
        buildUnsupportedAlert(ESwapDirectionType.FROM, context),
      ]);
      const { result } = renderHook(() => useSwapActionState(), {
        wrapper: Wrapper,
      });

      expect(result.current.shouldDepositToTrade).toBe(true);
      expect(result.current.disabled).toBe(false);
    },
  );

  it.each([
    ordinaryQuoteError,
    buildUnsupportedAlert(ESwapDirectionType.FROM, {}, ESwapAlertLevel.WARNING),
  ])('keeps deposit available for a non-blocking alert: $message', (alert) => {
    const { Wrapper } = createWrapper([alert]);
    const { result } = renderHook(() => useSwapActionState(), {
      wrapper: Wrapper,
    });

    expect(result.current.shouldDepositToTrade).toBe(true);
    expect(result.current.disabled).toBe(false);
  });

  it('recomputes the deposit verdict when only the TO account becomes identity-only', () => {
    mockToAddressInfo = { ...mockToAddressInfo, address: undefined };
    const { store, Wrapper } = createWrapper([
      ordinaryQuoteError,
      buildUnsupportedAlert(ESwapDirectionType.TO, { accountId: undefined }),
    ]);
    const alerts = store.get(swapAlertsAtom());
    const { result, rerender } = renderHook(() => useSwapActionState(), {
      wrapper: Wrapper,
    });
    expect(result.current.shouldDepositToTrade).toBe(true);

    // Keep address/readiness, FROM scope, alerts and intl stable. Only the TO
    // account identity changes, while the ordinary error keeps hasError true.
    mockToAddressInfo = {
      ...mockToAddressInfo,
      accountInfo: { ...toAccountInfo, account: undefined },
    };
    act(() => rerender());

    expect(store.get(swapAlertsAtom())).toBe(alerts);
    expect(result.current.shouldDepositToTrade).toBe(false);
    expect(result.current.disabled).toBe(true);
  });
});
