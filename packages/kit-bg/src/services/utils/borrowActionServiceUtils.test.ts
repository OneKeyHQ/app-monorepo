import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  type IBorrowActionServiceContext,
  borrowBuildApproveDelegationTransaction,
  borrowBuildBorrowTransaction,
  borrowBuildSetCollateralTransaction,
  borrowBuildSetEModeTransaction,
  borrowBuildWithdrawTransaction,
  borrowSwitchCheckEMode,
  getBorrowCheckAmount,
  getBorrowEModeStatus,
  getBorrowEstimateFee,
  getBorrowTransactionConfirmation,
} from './borrowActionServiceUtils';

import type { AxiosInstance } from 'axios';

describe('borrowActionServiceUtils', () => {
  const accountAddress = '0xaccount';
  const transaction = { tx: '0xunsigned' };
  const getAccountAddressForApi = jest.fn();
  const getClient = jest.fn();
  const get = jest.fn();
  const post = jest.fn();
  const service: IBorrowActionServiceContext = {
    backgroundApi: {
      serviceAccount: {
        getAccountAddressForApi,
      },
    },
    getClient,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAccountAddressForApi.mockResolvedValue(accountAddress);
    getClient.mockResolvedValue({ get, post } as unknown as AxiosInstance);
  });

  it('loads E-Mode status with normalized borrow addresses', async () => {
    const status = { enabled: true, eModeId: 1 };
    get.mockResolvedValue({ data: { data: status } });

    await expect(
      getBorrowEModeStatus(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        accountId: 'account-1',
      }),
    ).resolves.toEqual(status);

    expect(getClient).toHaveBeenCalledWith(EServiceEndpointEnum.Earn);
    expect(get).toHaveBeenCalledWith('/earn/v1/borrow/e-mode/status', {
      params: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        accountAddress,
      },
    });
  });

  it('keeps switch-check response envelope and request error mode', async () => {
    const switchCheck = {
      code: 0,
      message: 'ok',
      data: { canSwitch: true },
    };
    post.mockResolvedValue({ data: switchCheck });

    await expect(
      borrowSwitchCheckEMode(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        accountId: 'account-1',
        targetEModeId: 2,
        autoHandleError: false,
      }),
    ).resolves.toEqual(switchCheck);

    expect(post).toHaveBeenCalledWith(
      '/earn/v1/borrow/e-mode/switch-check',
      {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        targetEModeId: 2,
        accountAddress,
      },
      { autoHandleError: false },
    );
  });

  it('loads transaction confirmation with action-specific fields', async () => {
    const confirmation = { title: 'Set collateral' };
    get.mockResolvedValue({ data: { data: confirmation } });

    await expect(
      getBorrowTransactionConfirmation(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        reserveAddress: '0xRESERVE',
        accountId: 'account-1',
        action: 'setCollateral',
        amount: '1.50',
        useAsCollateral: true,
        eModeId: 2,
      }),
    ).resolves.toEqual(confirmation);

    expect(get).toHaveBeenCalledWith(
      '/earn/v1/borrow/transaction-confirmation',
      {
        params: {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xmarket',
          reserveAddress: '0xreserve',
          action: 'setCollateral',
          useAsCollateral: true,
          eModeId: 2,
          amount: '1.5',
          accountAddress,
        },
      },
    );
  });

  it.each([
    {
      call: () =>
        borrowBuildApproveDelegationTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
        }),
      path: '/earn/v1/borrow/build-approve-delegation-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        accountAddress,
      },
    },
    {
      call: () =>
        borrowBuildSetEModeTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          accountId: 'account-1',
          eModeId: 2,
        }),
      path: '/earn/v1/borrow/build-set-emode-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        eModeId: 2,
        accountAddress,
      },
    },
    {
      call: () =>
        borrowBuildSetCollateralTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          useAsCollateral: true,
          eModeId: 2,
        }),
      path: '/earn/v1/borrow/build-set-collateral-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        useAsCollateral: true,
        eModeId: 2,
        accountAddress,
      },
    },
  ])('builds advanced borrow transaction through $path', async (testCase) => {
    post.mockResolvedValue({ data: { data: transaction } });

    await expect(testCase.call()).resolves.toEqual(transaction);
    expect(post).toHaveBeenCalledWith(testCase.path, testCase.request);
  });

  it.each([
    {
      call: () =>
        borrowBuildWithdrawTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          amount: '1',
          withdrawAll: true,
          unwrap: true,
        }),
      path: '/earn/v1/borrow/build-withdraw-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        amount: '1',
        accountAddress,
        withdrawAll: true,
        unwrap: true,
      },
    },
    {
      call: () =>
        borrowBuildBorrowTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          amount: '2',
          unwrap: true,
        }),
      path: '/earn/v1/borrow/build-borrow-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        amount: '2',
        accountAddress,
        unwrap: true,
      },
    },
  ])('builds borrow transaction through $path', async (testCase) => {
    post.mockResolvedValue({ data: { data: transaction } });

    await expect(testCase.call()).resolves.toEqual(transaction);
    expect(post).toHaveBeenCalledWith(testCase.path, testCase.request);
  });

  it('returns the check-amount envelope with repay-all context', async () => {
    const checkResult = {
      code: 0,
      message: 'ok',
      data: { alerts: [] },
    };
    get.mockResolvedValue({ data: checkResult });

    await expect(
      getBorrowCheckAmount(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        reserveAddress: '0xRESERVE',
        accountId: 'account-1',
        action: 'repay',
        amount: '3.00',
        repayAll: true,
      }),
    ).resolves.toEqual(checkResult);
    expect(get).toHaveBeenCalledWith('/earn/v1/borrow/check-amount', {
      params: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        action: 'repay',
        amount: '3',
        accountAddress,
        repayAll: true,
      },
    });
  });

  it('loads estimate fee with withdraw-all context', async () => {
    const fee = { fee: '0.01' };
    get.mockResolvedValue({ data: { data: fee } });

    await expect(
      getBorrowEstimateFee(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        reserveAddress: '0xRESERVE',
        accountId: 'account-1',
        action: 'withdraw',
        amount: '4.00',
        withdrawAll: true,
      }),
    ).resolves.toEqual(fee);
    expect(get).toHaveBeenCalledWith('/earn/v1/borrow/estimate-fee', {
      params: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        action: 'withdraw',
        amount: '4',
        withdrawAll: true,
        accountAddress,
      },
    });
  });
});
