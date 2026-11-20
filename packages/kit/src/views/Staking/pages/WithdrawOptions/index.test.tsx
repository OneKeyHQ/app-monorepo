/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import WithdrawOptions from '@onekeyhq/kit/src/views/Staking/pages/WithdrawOptions';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import type { IClaimableListResponse } from '@onekeyhq/shared/types/staking';

import type { OptionList } from '../../components/OptionList';
import type { useUniversalWithdraw } from '../../hooks/useUniversalHooks';

type IRoute = IModalStakingParamList[EModalStakingRoutes.WithdrawOptions];
type IWithdrawParams = Parameters<ReturnType<typeof useUniversalWithdraw>>[0];

const requestOne = `0x${'11'.repeat(32)}`;
const requestTwo = `0x${'22'.repeat(32)}`;
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const mockExternalSuccess = jest.fn();
const mockPush = jest.fn();
const mockPop = jest.fn();
const mockRun = jest.fn();
const mockShowToastOfError = jest.fn<void, [unknown]>();
const mockUnhandledPickerError = jest.fn<void, [unknown]>();
const mockGetWithdrawList = jest.fn<
  Promise<IClaimableListResponse>,
  [unknown]
>();
const mockGetStakingConfigs = jest.fn<
  Promise<{ allowPartialWithdraw?: boolean }>,
  [unknown]
>();
const mockWithdraw = jest.fn<Promise<boolean>, [IWithdrawParams]>();
let mockRoute: IRoute;
let mockList: IClaimableListResponse;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: (error: unknown) => mockShowToastOfError(error),
    toastIfError: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: mockRoute }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pop: mockPop }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getWithdrawList: (params: unknown) => mockGetWithdrawList(params),
      getStakingConfigs: (params: unknown) => mockGetStakingConfigs(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => {
    void method();
    return { result: mockList, isLoading: false, run: mockRun };
  },
}));

jest.mock('../../hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: () => mockWithdraw,
}));

jest.mock('../../utils/babylon', () => ({
  useBabylonStatusMap: () => ({}),
  getBabylonPortfolioStatus: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: (date: Date) => date.toISOString(),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Page = Object.assign(Container, {
    Header: ({ title }: { title: string }) => <h1>{title}</h1>,
    Body: Container,
  });
  return {
    Page,
    SectionList: {
      SectionHeader: ({ title }: { title: string }) => <p>{title}</p>,
    },
  };
});

jest.mock('../../components/PageFrame', () => ({
  PageFrame: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SimpleSpinnerSkeleton: () => null,
  isLoadingState: () => false,
  isErrorState: () => false,
}));

jest.mock('../../components/OptionList', () => ({
  OptionList: ({
    items,
    token,
    onPress,
    onConfirmText,
    ListHeaderComponent,
    extraFields,
  }: ComponentProps<typeof OptionList>) => (
    <div>
      {ListHeaderComponent as ReactNode}
      {items.length ? (
        items.map((item) => (
          <div key={item.id}>
            <span>
              {item.amount} {token.symbol}
            </span>
            {extraFields?.map((field) => (
              <p key={field.name}>
                {field.name}: {field.renderItem({ item })}
              </p>
            ))}
            <button
              type="button"
              onClick={() => {
                const pending = onPress?.({ item });
                if (pending) {
                  void pending.catch((error: unknown) =>
                    mockUnhandledPickerError(error),
                  );
                }
              }}
            >
              {onConfirmText} {item.id}
            </button>
          </div>
        ))
      ) : (
        <p>No orders</p>
      )}
    </div>
  ),
}));

describe('WithdrawOptions cancellation requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithdraw.mockReset().mockResolvedValue(true);
    mockRoute = {
      accountId: 'account-1',
      networkId: 'evm--1',
      symbol: 'eETH',
      provider: 'etherfi',
      withdrawType: 'cancel',
      protocolInfo: {
        symbol: 'eETH',
        provider: 'etherfi',
        networkId: 'evm--1',
        earnAccount: {
          accountId: 'account-1',
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
        vault,
        stakeTag: '',
        providerDetail: { name: 'ether.fi', logoURI: '' },
      },
      onSuccess: mockExternalSuccess,
    };
    mockList = {
      token: {
        symbol: 'liquidETH',
        name: 'Liquid ETH',
        address: vault,
        decimals: 18,
        isNative: false,
      },
      items: [
        { id: requestOne, amount: '0.00001', timestamp: 1_800_000_000 },
        { id: requestTwo, amount: '0.00002', timestamp: 1_800_000_600 },
      ],
    };
    mockGetWithdrawList.mockResolvedValue(mockList);
    mockGetStakingConfigs.mockResolvedValue({});
  });

  it('fetches the chosen vault using the input symbol and displays shares and request details', () => {
    const screen = render(<WithdrawOptions />);

    expect(mockGetWithdrawList).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      symbol: 'eETH',
      provider: 'etherfi',
      vault,
      expectedAccountAddress: '0xowner',
    });
    expect(screen.getByText('0.00001 liquidETH')).toBeTruthy();
    expect(screen.getByText('0.00002 liquidETH')).toBeTruthy();
    expect(screen.getByText(/0x111111\.\.\.111111/)).toBeTruthy();
    expect(screen.getByText(/2027-01-15T08:00:00.000Z/)).toBeTruthy();
    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(mockGetStakingConfigs).not.toHaveBeenCalled();
  });

  it('keeps the route symbol for cancellation when tokenInfo is the receipt token', async () => {
    mockRoute = {
      ...mockRoute,
      tokenInfo: {
        accountId: 'account-1',
        networkId: 'evm--1',
        provider: 'etherfi',
        vault,
        balanceParsed: '1',
        price: '1',
        token: {
          ...mockList.token,
          uniqueKey: 'evm--1_liquidETH',
          isNative: false,
          logoURI: '',
          totalSupply: '0',
          riskLevel: 0,
          coingeckoId: '',
          networkId: 'evm--1',
        },
      },
    };
    const screen = render(<WithdrawOptions />);
    expect(mockGetWithdrawList).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'eETH', provider: 'etherfi', vault }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    await waitFor(() =>
      expect(mockWithdraw).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'eETH', identity: requestOne }),
      ),
    );
  });

  it('cancels only the selected identity without interpreting its share amount as underlying assets', async () => {
    const screen = render(<WithdrawOptions />);

    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestTwo}` }),
    );

    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
    expect(mockWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: requestTwo,
        amount: '0',
        symbol: 'eETH',
        provider: 'etherfi',
        protocolVault: vault,
        withdrawType: 'cancel',
        withdrawAll: false,
      }),
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();

    act(() => {
      mockWithdraw.mock.calls[0][0].onSuccess?.([]);
    });
    expect(mockPop).toHaveBeenCalledTimes(1);
    expect(mockExternalSuccess).toHaveBeenCalledTimes(1);
  });

  it('reports cancellation preparation failure and allows the current picker to retry', async () => {
    const error = new OneKeyLocalError('Cancellation transaction build failed');
    mockWithdraw.mockRejectedValueOnce(error).mockResolvedValueOnce(true);
    const screen = render(<WithdrawOptions />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
    expect(mockShowToastOfError).toHaveBeenCalledWith(error);
    expect(mockUnhandledPickerError).not.toHaveBeenCalled();
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(2));
    expect(mockWithdraw.mock.calls[1][0].identity).toBe(requestOne);
  });

  it('does not report a stale cancellation failure on the new scope', async () => {
    const error = new OneKeyLocalError('Cancellation transaction build failed');
    let fail: (error: unknown) => void = () => undefined;
    const pending = new Promise<boolean>((_resolve, reject) => {
      fail = reject;
    });
    mockWithdraw.mockReturnValueOnce(pending).mockResolvedValueOnce(true);
    const screen = render(<WithdrawOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
    if (!mockRoute.protocolInfo?.earnAccount)
      throw new OneKeyLocalError('Missing account fixture');
    mockRoute = {
      ...mockRoute,
      accountId: 'account-2',
      protocolInfo: {
        ...mockRoute.protocolInfo,
        earnAccount: {
          ...mockRoute.protocolInfo.earnAccount,
          accountId: 'account-2',
        },
      },
    };
    screen.rerender(<WithdrawOptions />);
    await act(async () => {
      fail(error);
      await pending.catch(() => undefined);
    });
    expect(mockShowToastOfError).not.toHaveBeenCalled();
    expect(mockUnhandledPickerError).not.toHaveBeenCalled();
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestTwo}` }),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(2));
    expect(mockWithdraw.mock.calls[1][0].identity).toBe(requestTwo);
  });

  it('serializes cancellation preparation and allows a later explicit attempt', async () => {
    let finish: (value: boolean) => void = () => undefined;
    const pending = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    mockWithdraw.mockReturnValueOnce(pending).mockResolvedValueOnce(true);
    const screen = render(<WithdrawOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestTwo}` }),
    );
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
    const first = mockWithdraw.mock.calls[0][0];
    expect(first.identity).toBe(requestOne);
    expect(first.isActionCurrent?.()).toBe(true);

    await act(async () => {
      finish(false);
      await pending;
    });
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestTwo}` }),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(2));
    const second = mockWithdraw.mock.calls[1][0];
    expect(second.identity).toBe(requestTwo);
    expect(second.isActionCurrent?.()).toBe(true);
    expect(first.isActionCurrent?.()).toBe(false);
    act(() => first.onSuccess?.([]));
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();
  });

  it('invalidates an open cancellation when its picker unmounts', async () => {
    const screen = render(<WithdrawOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
    const params = mockWithdraw.mock.calls[0][0];
    expect(params.isActionCurrent?.()).toBe(true);

    screen.unmount();
    expect(params.isActionCurrent?.()).toBe(false);
    act(() => params.onSuccess?.([]));
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();
  });

  it.each(['account', 'network', 'vault'] as const)(
    'invalidates cancellation when %s changes and changes back',
    async (changedField) => {
      const original = mockRoute;
      const originalProtocol = original.protocolInfo;
      if (!originalProtocol)
        throw new OneKeyLocalError('Missing protocol fixture');
      if (!originalProtocol.earnAccount)
        throw new OneKeyLocalError('Missing account fixture');
      const screen = render(<WithdrawOptions />);
      fireEvent.click(
        screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
      );
      await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
      const params = mockWithdraw.mock.calls[0][0];
      expect(params.isActionCurrent?.()).toBe(true);

      mockRoute = {
        ...original,
        accountId:
          changedField === 'account' ? 'account-2' : original.accountId,
        networkId: changedField === 'network' ? 'evm--2' : original.networkId,
        protocolInfo: {
          ...originalProtocol,
          earnAccount: {
            ...originalProtocol.earnAccount,
            accountId:
              changedField === 'account' ? 'account-2' : original.accountId,
            networkId:
              changedField === 'network' ? 'evm--2' : original.networkId,
          },
          vault:
            changedField === 'vault' ? '0xanother' : originalProtocol.vault,
        },
      };
      screen.rerender(<WithdrawOptions />);
      mockRoute = original;
      screen.rerender(<WithdrawOptions />);

      expect(params.isActionCurrent?.()).toBe(false);
      act(() => params.onSuccess?.([]));
      expect(mockPop).not.toHaveBeenCalled();
      expect(mockExternalSuccess).not.toHaveBeenCalled();
    },
  );

  it('distinguishes requests with the same amount and submission time', () => {
    mockList.items[1] = {
      ...mockList.items[1],
      amount: mockList.items[0].amount,
      timestamp: mockList.items[0].timestamp,
    };
    const screen = render(<WithdrawOptions />);
    expect(screen.getAllByText('0.00001 liquidETH')).toHaveLength(2);
    expect(screen.getByText(/0x111111\.\.\.111111/)).toBeTruthy();
    expect(screen.getByText(/0x222222\.\.\.222222/)).toBeTruthy();
  });

  it('keeps the picker open if the risk warning is declined', async () => {
    mockWithdraw.mockResolvedValue(false);
    const screen = render(<WithdrawOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: `global.cancel ${requestOne}` }),
    );
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockExternalSuccess).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'uses the normal request list and empty state (hasRequests=%s)',
    (hasRequests) => {
      if (!hasRequests) mockList.items = [];
      const screen = render(<WithdrawOptions />);
      expect(screen.queryAllByText('No orders')).toHaveLength(
        hasRequests ? 0 : 1,
      );
      expect(screen.queryAllByRole('button')).toHaveLength(hasRequests ? 2 : 0);
    },
  );

  it('retains the normal withdrawal amount form for existing order flows', async () => {
    mockRoute.withdrawType = undefined;
    const screen = render(<WithdrawOptions />);
    fireEvent.click(
      screen.getByRole('button', { name: `global.withdraw ${requestOne}` }),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        EModalStakingRoutes.Withdraw,
        expect.objectContaining({ identity: requestOne, amount: '0.00001' }),
      ),
    );
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('keeps the token symbol and protocol provider for other providers', () => {
    mockRoute = {
      ...mockRoute,
      provider: 'route-provider',
      symbol: 'route-symbol',
      withdrawType: undefined,
      protocolInfo: {
        networkId: 'evm--1',
        vault,
        stakeTag: '',
        providerDetail: { name: 'Stakefish', logoURI: '' },
        provider: 'stakefish',
        symbol: 'protocol-symbol',
      },
      tokenInfo: {
        accountId: 'account-1',
        networkId: 'evm--1',
        provider: 'stakefish',
        vault,
        balanceParsed: '1',
        price: '1',
        token: {
          ...mockList.token,
          uniqueKey: 'evm--1_liquidETH',
          isNative: false,
          logoURI: '',
          totalSupply: '0',
          riskLevel: 0,
          coingeckoId: '',
          networkId: 'evm--1',
        },
      },
    };

    render(<WithdrawOptions />);

    expect(mockGetWithdrawList).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'liquidETH', provider: 'stakefish' }),
    );
    expect(mockGetStakingConfigs).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'liquidETH', provider: 'stakefish' }),
    );
  });
});
