/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import WithdrawOptions from '@onekeyhq/kit/src/views/Staking/pages/WithdrawOptions';
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
                void onPress?.({ item });
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
    });
    expect(screen.getByText('0.00001 liquidETH')).toBeTruthy();
    expect(screen.getByText('0.00002 liquidETH')).toBeTruthy();
    expect(screen.getByText(/0x111111\.\.\.111111/)).toBeTruthy();
    expect(screen.getByText(/2027-01-15T08:00:00.000Z/)).toBeTruthy();
    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(mockGetStakingConfigs).not.toHaveBeenCalled();
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
});
