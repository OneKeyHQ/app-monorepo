/** @jest-environment jsdom */
/* eslint-disable import/first */
import type { ComponentProps, ReactNode } from 'react';

const mockHandleWithdraw = jest.fn(async () => true);
const mockForm = jest.fn<void, [IFormProps]>();
const mockRoute = jest.fn<
  {
    params: {
      accountId: string;
      networkId: string;
      protocolInfo: IProtocolInfo;
      tokenInfo: IEarnTokenInfo;
    };
  },
  []
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Page = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  Page.Header = () => null;
  Page.Body = Page;
  return { Page };
});
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: jest.fn(), pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => mockRoute(),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _fn: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult, isLoading: false }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: {}, serviceToken: {} },
}));
jest.mock('../hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: () => mockHandleWithdraw,
}));
jest.mock('../hooks/useEarnWithdrawAssets', () => ({
  useEarnWithdrawAssets: () => ({
    assets: [],
    selectedAsset: undefined,
    status: 'ready',
    retry: jest.fn(),
  }),
}));
jest.mock('../hooks/useBorrowApiParams', () => ({
  useBorrowApiParams: () => ({ isBorrow: false, borrowApiParams: {} }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => ({
    useUniversalBorrowWithdraw: () => jest.fn(),
    useUniversalBorrowRepay: () => jest.fn(),
    useUniversalBorrowRepayWithCollateral: () => jest.fn(),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Borrow/components/ManagePosition', () => ({
  ManagePosition: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/BorrowRepayPosition',
  () => ({ BorrowRepayPosition: () => null }),
);
jest.mock('../components/EarnProtocolForms/Withdraw', () => ({
  EarnWithdrawForm: (props: IFormProps) => {
    mockForm(props);
    return null;
  },
}));
jest.mock('../../Discovery/components/DiscoveryBrowserProviderMirror', () => ({
  DiscoveryBrowserProviderMirror: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IProtocolInfo,
  IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';

import { WithdrawSection } from './ManagePosition/components/WithdrawSection';
import WithdrawPage from './Withdraw';

import type { EarnWithdrawForm } from '../components/EarnProtocolForms/Withdraw';

type IFormProps = ComponentProps<typeof EarnWithdrawForm>;
const networkId = 'evm--1';
const accountId = 'account';
const accountAddress = '0xOwner';
const protocolInfo = {
  provider: 'lido',
  networkId,
  symbol: 'ETH',
  vault: '',
  stakeTag: '',
  providerDetail: { name: 'Lido', logoURI: '' },
  earnAccount: { accountId, networkId, accountAddress, account: {} },
} as IProtocolInfo;
const tokenInfo = {
  token: { symbol: 'ETH', address: '', isNative: true, decimals: 18 },
  price: '1',
} as IEarnTokenInfo;

beforeEach(() => {
  mockForm.mockClear();
  mockHandleWithdraw.mockClear();
});

it.each(['withdraw page', 'manage position'] as const)(
  'forwards the displayed task owner from the %s confirmation',
  async (entry) => {
    if (entry === 'withdraw page') {
      mockRoute.mockReturnValue({
        params: { accountId, networkId, protocolInfo, tokenInfo },
      });
      render(<WithdrawPage />);
    } else
      render(
        <WithdrawSection
          accountId={accountId}
          networkId={networkId}
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
        />,
      );
    const form = mockForm.mock.calls.at(-1)?.[0];
    if (!form) throw new OneKeyLocalError('Withdraw form was not rendered');
    expect(form.accountAddress).toBe(accountAddress);
    await act(async () => {
      await form.onConfirm?.({
        amount: '1',
        withdrawAll: false,
        taskAccountAddress: form.accountAddress,
      });
    });
    expect(mockHandleWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({ taskAccountAddress: accountAddress }),
    );
  },
);

it.each(['withdraw page', 'manage position'] as const)(
  'preserves a missing optional owner from the %s',
  async (entry) => {
    const withoutOwner = { ...protocolInfo, earnAccount: undefined };
    if (entry === 'withdraw page') {
      mockRoute.mockReturnValue({
        params: { accountId, networkId, protocolInfo: withoutOwner, tokenInfo },
      });
      render(<WithdrawPage />);
    } else
      render(
        <WithdrawSection
          accountId={accountId}
          networkId={networkId}
          protocolInfo={withoutOwner}
          tokenInfo={tokenInfo}
        />,
      );
    const form = mockForm.mock.calls.at(-1)?.[0];
    if (!form) throw new OneKeyLocalError('Withdraw form was not rendered');
    expect(form.accountAddress).toBe('');
    await act(async () => {
      await form.onConfirm?.({ amount: '1', withdrawAll: false });
    });
    expect(mockHandleWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({ taskAccountAddress: undefined }),
    );
  },
);
