/** @jest-environment jsdom */

import { StrictMode, useLayoutEffect } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import WithdrawOptions from '@onekeyhq/kit/src/views/Staking/pages/WithdrawOptions';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { IClaimableListResponse } from '@onekeyhq/shared/types/staking';

import type { OptionList } from '../../components/OptionList';

type IRoute = IModalStakingParamList[EModalStakingRoutes.WithdrawOptions];
const mockGetList = jest.fn<Promise<IClaimableListResponse>, [unknown]>();
const mockGetConfigs = jest.fn<
  Promise<{ allowPartialWithdraw?: boolean } | null>,
  []
>();
const mockWithdraw = jest.fn();
const mockPush = jest.fn();
let mockRoute: IRoute;
let mockLastOnPress: ComponentProps<typeof OptionList>['onPress'];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: mockRoute }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pop: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getWithdrawList: (p: unknown) => mockGetList(p),
      getStakingConfigs: () => mockGetConfigs(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('../../hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: () => mockWithdraw,
}));
jest.mock('../../utils/babylon', () => ({
  useBabylonStatusMap: () => ({}),
  getBabylonPortfolioStatus: jest.fn(),
}));
jest.mock('@onekeyhq/components', () => {
  const deferredPromise = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    SectionList: { SectionHeader: () => null },
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredPromise.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('../../components/PageFrame', () => ({
  PageFrame: ({
    children,
    loading,
    error,
    onRefresh,
  }: {
    children?: ReactNode;
    loading?: boolean;
    error?: boolean;
    onRefresh?: () => void;
  }) => {
    if (loading) return <div>loading</div>;
    if (error)
      return (
        <div>
          error{' '}
          <button type="button" onClick={onRefresh}>
            retry
          </button>
        </div>
      );
    return (
      <div>
        {children}
        <button type="button" onClick={onRefresh}>
          refresh
        </button>
      </div>
    );
  },
  SimpleSpinnerSkeleton: () => null,
  isLoadingState: ({
    result,
    isLoading,
  }: {
    result: unknown;
    isLoading?: boolean;
  }) => result === undefined && isLoading !== false,
  isErrorState: ({
    result,
    isLoading,
  }: {
    result: unknown;
    isLoading?: boolean;
  }) => result === undefined && isLoading === false,
}));
jest.mock('../../components/OptionList', () => ({
  OptionList: ({ items, onPress }: ComponentProps<typeof OptionList>) => {
    mockLastOnPress = onPress;
    return (
      <div>
        {items.length === 0 ? <span>No orders</span> : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void onPress?.({ item })}
          >
            {item.id}
          </button>
        ))}
      </div>
    );
  },
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function list(id: string): IClaimableListResponse {
  return {
    token: {
      symbol: 'liquidETH',
      name: 'Liquid ETH',
      address: '0xvault',
      decimals: 18,
      isNative: false,
    },
    items: [{ id, amount: '1' }],
  };
}

function withMatchingEarnAccount(route: IRoute): IRoute {
  const info = route.protocolInfo;
  if (!info?.earnAccount) return route;
  return {
    ...route,
    protocolInfo: {
      ...info,
      earnAccount: {
        ...info.earnAccount,
        accountId: route.accountId,
        networkId: route.networkId,
      },
    },
  };
}

describe('EtherFi cancellation request scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastOnPress = undefined;
    mockWithdraw.mockResolvedValue(true);
    mockGetConfigs.mockResolvedValue({});
    mockRoute = {
      accountId: 'account-a',
      networkId: 'evm--1',
      symbol: 'eETH',
      provider: 'etherfi',
      withdrawType: 'cancel',
      protocolInfo: {
        symbol: 'eETH',
        provider: 'etherfi',
        networkId: 'evm--1',
        earnAccount: {
          accountId: 'account-a',
          networkId: 'evm--1',
          accountAddress: '0xowner',
          account: {
            id: 'account-1',
            name: 'Account',
            type: undefined,
            path: '',
            coinType: '60',
            impl: 'evm',
            pub: '',
            address: '0xowner',
            addressDetail: {
              isValid: true,
              networkId: 'evm--1',
              address: '0xowner',
              baseAddress: '0xowner',
              normalizedAddress: '0xowner',
              displayAddress: '0xowner',
              allowEmptyAddress: false,
            },
          },
        },
        vault: '0xvault',
        stakeTag: '',
        providerDetail: { name: 'ether.fi', logoURI: '' },
      },
    };
  });

  it.each(['accountId', 'networkId'] as const)(
    'invalidates the old list when the nested %s changes with the same address',
    async (field) => {
      mockGetList.mockResolvedValue(list('old'));
      const screen = render(<WithdrawOptions />);
      await screen.findByRole('button', { name: 'old' });
      const oldPress = mockLastOnPress;
      const protocol = mockRoute.protocolInfo;
      if (!protocol?.earnAccount)
        throw new OneKeyLocalError('Missing account fixture');
      mockRoute = {
        ...mockRoute,
        protocolInfo: {
          ...protocol,
          earnAccount: { ...protocol.earnAccount, [field]: 'other' },
        },
      };
      screen.rerender(<WithdrawOptions />);
      await screen.findByText('error');
      expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
      await act(async () => oldPress?.({ item: { id: 'old', amount: '1' } }));
      expect(mockGetList).toHaveBeenCalledTimes(1);
      expect(mockWithdraw).not.toHaveBeenCalled();
    },
  );

  it.each(['account', 'network', 'vault'] as const)(
    'hides the old requests while the new %s request is pending or fails',
    async (field) => {
      const next = deferred<IClaimableListResponse>();
      mockGetList
        .mockResolvedValueOnce(list('old'))
        .mockReturnValueOnce(next.promise);
      const screen = render(<WithdrawOptions />);
      await screen.findByRole('button', { name: 'old' });
      const oldPress = mockLastOnPress;
      const protocol = mockRoute.protocolInfo;
      if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
      mockRoute = withMatchingEarnAccount({
        ...mockRoute,
        accountId: field === 'account' ? 'account-b' : mockRoute.accountId,
        networkId: field === 'network' ? 'evm--2' : mockRoute.networkId,
        protocolInfo: {
          ...protocol,
          vault: field === 'vault' ? '0xother' : protocol.vault,
        },
      });
      screen.rerender(<WithdrawOptions />);
      expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
      await act(async () => {
        await oldPress?.({ item: { id: 'old', amount: '1' } });
      });
      expect(mockWithdraw).not.toHaveBeenCalled();
      await act(async () => {
        next.reject(new Error('network failed'));
      });
      expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
      expect(await screen.findByText('error')).toBeTruthy();
    },
  );

  it('rejects a previous account handler during the new account layout commit', async () => {
    mockGetList.mockResolvedValue(list('old'));
    const screen = render(<WithdrawOptions />);
    await screen.findByRole('button', { name: 'old' });
    const oldPress = mockLastOnPress;
    let invoked = false;
    const InvokePreviousHandler = () => {
      useLayoutEffect(() => {
        invoked = true;
        void oldPress?.({ item: { id: 'old', amount: '1' } });
      }, []);
      return null;
    };
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-b',
    });
    screen.rerender(
      <>
        <WithdrawOptions />
        <InvokePreviousHandler />
      </>,
    );
    expect(invoked).toBe(true);
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('does not reuse a late result after switching away and back', async () => {
    const first = deferred<IClaimableListResponse>();
    const second = deferred<IClaimableListResponse>();
    const current = deferred<IClaimableListResponse>();
    mockGetList
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(current.promise);
    const screen = render(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(1));
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-b',
    });
    screen.rerender(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(2));
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-a',
    });
    screen.rerender(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(3));
    await act(async () => {
      first.resolve(list('stale'));
      second.resolve(list('other'));
    });
    expect(screen.queryByRole('button', { name: 'stale' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'other' })).toBeNull();
    await act(async () => {
      current.resolve(list('current'));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
  });

  it('clears a stale list after refresh fails and allows a successful retry', async () => {
    mockGetList.mockResolvedValueOnce(list('old'));
    mockGetList.mockRejectedValueOnce(new OneKeyLocalError('network failed'));
    mockGetList.mockResolvedValueOnce(list('current'));
    const screen = render(<WithdrawOptions />);
    await screen.findByRole('button', { name: 'old' });
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
    await screen.findByText('error');
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByRole('button', { name: 'current' })).toBeTruthy();
  });

  it('retries a failed request after StrictMode reconnects effects', async () => {
    mockGetList.mockRejectedValue(new OneKeyLocalError('network failed'));
    const screen = render(
      <StrictMode>
        <WithdrawOptions />
      </StrictMode>,
    );
    await screen.findByText('error');
    const callsBeforeRetry = mockGetList.mock.calls.length;
    mockGetList.mockResolvedValue(list('current'));
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() =>
      expect(mockGetList.mock.calls.length).toBeGreaterThan(callsBeforeRetry),
    );
    expect(await screen.findByRole('button', { name: 'current' })).toBeTruthy();
  });

  it('hides old requests for another provider when the account changes', async () => {
    const pending = deferred<IClaimableListResponse>();
    mockGetList
      .mockResolvedValueOnce(list('old'))
      .mockReturnValueOnce(pending.promise);
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    await screen.findByRole('button', { name: 'old' });
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-b',
    });
    screen.rerender(<WithdrawOptions />);
    expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
    await act(async () => {
      pending.resolve(list('current'));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('ignores a rejected request after its account scope is unmounted', async () => {
    const old = deferred<IClaimableListResponse>();
    const current = deferred<IClaimableListResponse>();
    mockGetList
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const screen = render(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(1));
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-b',
    });
    screen.rerender(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(2));
    await act(async () => {
      old.reject(new OneKeyLocalError('old request failed'));
    });
    await act(async () => {
      current.resolve(list('current'));
    });
    expect(await screen.findByRole('button', { name: 'current' })).toBeTruthy();
  });

  it('ignores a rejected old staking configuration after an account change', async () => {
    const old = deferred<{ allowPartialWithdraw?: boolean }>();
    mockGetConfigs.mockReturnValueOnce(old.promise).mockResolvedValue({});
    mockGetList.mockResolvedValue(list('current'));
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalledTimes(1));
    mockRoute = withMatchingEarnAccount({
      ...mockRoute,
      accountId: 'account-b',
    });
    screen.rerender(<WithdrawOptions />);
    await waitFor(() => expect(mockGetConfigs).toHaveBeenCalledTimes(2));
    await act(async () => {
      old.reject(new OneKeyLocalError('old configuration failed'));
    });
    expect(await screen.findByRole('button', { name: 'current' })).toBeTruthy();
  });

  it('waits for the partial withdrawal configuration before opening an order', async () => {
    const config = deferred<{ allowPartialWithdraw?: boolean }>();
    const requests = deferred<IClaimableListResponse>();
    mockGetConfigs.mockReturnValue(config.promise);
    mockGetList.mockReturnValue(requests.promise);
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    await waitFor(() => expect(mockGetList).toHaveBeenCalled());
    await act(async () => {
      requests.resolve(list('current'));
    });
    expect(screen.queryByRole('button', { name: 'current' })).toBeNull();
    await act(async () => {
      config.resolve({ allowPartialWithdraw: true });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowPartialWithdraw: true }),
    );
  });

  it('shows a retry when the withdrawal configuration fails', async () => {
    mockGetConfigs.mockRejectedValueOnce(
      new OneKeyLocalError('configuration failed'),
    );
    mockGetConfigs.mockResolvedValueOnce({ allowPartialWithdraw: true });
    mockGetList.mockResolvedValue(list('current'));
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    await screen.findByText('error');
    expect(screen.queryByRole('button', { name: 'current' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowPartialWithdraw: true }),
    );
  });

  it('treats an absent protocol configuration as a settled result', async () => {
    mockGetConfigs.mockResolvedValue(null);
    mockGetList.mockResolvedValue(list('current'));
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowPartialWithdraw: undefined }),
    );
  });

  it('shows a list error without waiting for a slow configuration', async () => {
    const config = deferred<{ allowPartialWithdraw?: boolean }>();
    mockGetConfigs
      .mockReturnValueOnce(config.promise)
      .mockResolvedValue({ allowPartialWithdraw: true });
    mockGetList
      .mockRejectedValueOnce(new OneKeyLocalError('list failed'))
      .mockResolvedValue(list('current'));
    const protocol = mockRoute.protocolInfo;
    if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
    mockRoute = {
      ...mockRoute,
      withdrawType: undefined,
      provider: 'stakefish',
      protocolInfo: { ...protocol, provider: 'stakefish' },
    };
    const screen = render(<WithdrawOptions />);
    await screen.findByText('error');
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'current' }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowPartialWithdraw: true }),
    );
    await act(async () => {
      config.resolve({ allowPartialWithdraw: false });
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'failed'] as const)(
    'shows the confirmed empty order list while configuration is %s',
    async (state) => {
      const config = deferred<{ allowPartialWithdraw?: boolean }>();
      mockGetConfigs.mockReturnValue(config.promise);
      mockGetList.mockResolvedValue({ ...list('unused'), items: [] });
      const protocol = mockRoute.protocolInfo;
      if (!protocol) throw new OneKeyLocalError('Missing protocol fixture');
      mockRoute = {
        ...mockRoute,
        withdrawType: undefined,
        provider: 'stakefish',
        protocolInfo: { ...protocol, provider: 'stakefish' },
      };
      const screen = render(<WithdrawOptions />);
      await waitFor(() => expect(mockGetList).toHaveBeenCalled());
      if (state === 'failed') {
        await act(async () => {
          config.reject(new OneKeyLocalError('configuration failed'));
        });
      }
      expect(await screen.findByText('No orders')).toBeTruthy();
      expect(screen.queryByText('error')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    },
  );
});
