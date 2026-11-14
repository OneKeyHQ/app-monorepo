import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  type IBorrowActionServiceContext,
  borrowBuildApproveDelegationTransaction,
  borrowBuildBorrowTransaction,
  borrowBuildClaimTransaction,
  borrowBuildRepayTransaction,
  borrowBuildRepayWithCollateralTransaction,
  borrowBuildSetCollateralTransaction,
  borrowBuildSetEModeTransaction,
  borrowBuildSetupLutTransaction,
  borrowBuildSupplyTransaction,
  borrowBuildWithdrawTransaction,
  borrowSwitchCheckEMode,
  getBorrowCheckAmount,
  getBorrowEModeStatus,
  getBorrowEstimateFee,
  getBorrowHealthFactor,
  getBorrowManagePage,
  getBorrowRepayWithCollateralQuote,
  getBorrowReserveDetails,
  getBorrowRewards,
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

  it.each(['emode', 'collateral', 'check'] as const)(
    'rejects a transient A to B to A address change before the %s request',
    async (action) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi
        .mockResolvedValueOnce('0xOwnerA')
        .mockResolvedValueOnce('0xOwnerB')
        .mockResolvedValueOnce('0xOwnerA');
      expect(await getAccountAddressForApi()).toBe('0xOwnerA');
      post.mockResolvedValue({ data: { data: transaction } });
      const params = {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        reserveAddress: '0xReserve',
        accountId: 'account-1',
        eModeId: 2,
        targetEModeId: 2,
        useAsCollateral: false,
        expectedAccountAddress: '0xOwnerA',
      };
      let request: Promise<unknown>;
      if (action === 'emode')
        request = borrowBuildSetEModeTransaction(service, params);
      else if (action === 'collateral')
        request = borrowBuildSetCollateralTransaction(service, params);
      else request = borrowSwitchCheckEMode(service, params);
      await expect(request).rejects.toThrow('Borrow account changed');
      expect(await getAccountAddressForApi()).toBe('0xOwnerA');
      expect(getClient).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each(['emode', 'collateral', 'check'] as const)(
    'accepts the same EVM owner for the %s request without transmitting the local guard',
    async (action) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi.mockResolvedValue('0xAbCd');
      post.mockResolvedValue({ data: { data: transaction } });
      const params = {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        reserveAddress: '0xReserve',
        accountId: 'account-1',
        eModeId: 2,
        targetEModeId: 2,
        useAsCollateral: false,
        expectedAccountAddress: '0xabcd',
      };
      if (action === 'emode')
        await borrowBuildSetEModeTransaction(service, params);
      else if (action === 'collateral')
        await borrowBuildSetCollateralTransaction(service, params);
      else await borrowSwitchCheckEMode(service, params);
      expect(post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ accountAddress: '0xAbCd' }),
        ...(action === 'check' ? [undefined] : []),
      );
      expect(post.mock.calls[0][1]).not.toHaveProperty(
        'expectedAccountAddress',
      );
    },
  );

  it.each([
    ['confirmation', getBorrowTransactionConfirmation],
    ['check amount', getBorrowCheckAmount],
  ] as const)(
    'rejects a transient A to B to A address change before collateral repay %s',
    async (_label, request) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi
        .mockResolvedValueOnce('AddressA')
        .mockResolvedValueOnce('AddressB')
        .mockResolvedValueOnce('AddressA');
      expect(await getAccountAddressForApi()).toBe('AddressA');
      get.mockResolvedValue({ code: 0, data: { data: {} } });
      const params = {
        accountId: 'account-1',
        networkId: 'sol--101',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        amount: '1',
        collateralReserveAddress: 'collateral',
        action: 'repayWithCollateral' as const,
        expectedAccountAddress: 'AddressA',
      };
      await expect(request(service, params)).rejects.toThrow(
        'Borrow account changed',
      );
      expect(await getAccountAddressForApi()).toBe('AddressA');
      expect(get).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['confirmation', getBorrowTransactionConfirmation],
    ['check amount', getBorrowCheckAmount],
  ] as const)(
    'uses the verified local address without forwarding it as metadata for %s',
    async (_label, request) => {
      getAccountAddressForApi.mockResolvedValue('AddressA');
      get.mockResolvedValue({ data: { data: {} } });
      const params = {
        accountId: 'account-1',
        networkId: 'sol--101',
        provider: 'kamino',
        marketAddress: 'market',
        reserveAddress: 'reserve',
        amount: '1',
        collateralReserveAddress: 'collateral',
        action: 'repayWithCollateral' as const,
        expectedAccountAddress: 'AddressA',
      };
      await request(service, params);
      const options = get.mock.calls[0][1];
      expect(options.params.accountAddress).toBe('AddressA');
      expect(options.params).not.toHaveProperty('expectedAccountAddress');
      await request(service, { ...params, expectedAccountAddress: undefined });
      expect(get).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['supply', 'borrow', 'withdraw', 'repay', 'delegation'] as const)(
    'rejects a transient A to B to A account change before the %s builder request',
    async (action) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi
        .mockResolvedValueOnce('0xAccountA')
        .mockResolvedValueOnce('0xAccountB')
        .mockResolvedValueOnce('0xAccountA');
      expect(await getAccountAddressForApi()).toBe('0xAccountA');
      post.mockResolvedValue({ data: { data: transaction } });
      const params = {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        reserveAddress: '0xReserve',
        accountId: 'account-1',
        amount: '1',
        expectedAccountAddress: '0xAccountA',
      };
      const builders = {
        supply: borrowBuildSupplyTransaction,
        borrow: borrowBuildBorrowTransaction,
        withdraw: borrowBuildWithdrawTransaction,
        repay: borrowBuildRepayTransaction,
        delegation: borrowBuildApproveDelegationTransaction,
      };
      await expect(builders[action](service, params)).rejects.toThrow(
        'Borrow account changed',
      );
      expect(await getAccountAddressForApi()).toBe('0xAccountA');
      expect(getClient).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each(['supply', 'borrow', 'withdraw', 'repay', 'delegation'] as const)(
    'accepts the same EVM owner for %s without sending the local binding to the API',
    async (action) => {
      getAccountAddressForApi.mockResolvedValue('0xAbCd');
      post.mockResolvedValue({ data: { data: transaction } });
      const builders = {
        supply: borrowBuildSupplyTransaction,
        borrow: borrowBuildBorrowTransaction,
        withdraw: borrowBuildWithdrawTransaction,
        repay: borrowBuildRepayTransaction,
        delegation: borrowBuildApproveDelegationTransaction,
      };
      await expect(
        builders[action](service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMarket',
          reserveAddress: '0xReserve',
          accountId: 'account-1',
          amount: '1',
          expectedAccountAddress: '0xabcd',
        }),
      ).resolves.toEqual(transaction);
      expect(post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ accountAddress: '0xAbCd' }),
      );
      expect(post.mock.calls[0][1]).not.toHaveProperty(
        'expectedAccountAddress',
      );
    },
  );

  it.each(['supply', 'borrow', 'withdraw', 'repay', 'delegation'] as const)(
    'rejects an address with different Solana casing for %s',
    async (action) => {
      getAccountAddressForApi.mockResolvedValue('addressa');
      const builders = {
        supply: borrowBuildSupplyTransaction,
        borrow: borrowBuildBorrowTransaction,
        withdraw: borrowBuildWithdrawTransaction,
        repay: borrowBuildRepayTransaction,
        delegation: borrowBuildApproveDelegationTransaction,
      };
      await expect(
        builders[action](service, {
          networkId: 'sol--101',
          provider: 'kamino',
          marketAddress: 'Market',
          reserveAddress: 'Reserve',
          accountId: 'account-1',
          amount: '1',
          expectedAccountAddress: 'AddressA',
        }),
      ).rejects.toThrow('Borrow account changed');
      expect(getClient).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each(['setup', 'quote', 'repay'] as const)(
    'rejects a changed Solana account before the %s request is sent',
    async (action) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi
        .mockResolvedValueOnce('AddressA')
        .mockResolvedValueOnce('AddressB')
        .mockResolvedValueOnce('AddressA');
      expect(await getAccountAddressForApi()).toBe('AddressA');
      const base = {
        networkId: 'sol--101',
        provider: 'kamino',
        marketAddress: 'Market',
        reserveAddress: 'Reserve',
        collateralReserveAddress: 'Collateral',
        accountId: 'account-1',
        expectedAccountAddress: 'AddressA',
      };
      let request: Promise<unknown>;
      if (action === 'setup')
        request = borrowBuildSetupLutTransaction(service, base);
      else if (action === 'quote')
        request = getBorrowRepayWithCollateralQuote(service, {
          ...base,
          amount: '1',
        });
      else
        request = borrowBuildRepayWithCollateralTransaction(service, {
          ...base,
          amount: '1',
        });
      await expect(request).rejects.toThrow('Borrow account changed');
      expect(await getAccountAddressForApi()).toBe('AddressA');
      expect(getClient).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('does not treat different Solana address casing as the same owner', async () => {
    getAccountAddressForApi.mockReset().mockResolvedValue('addressa');
    await expect(
      borrowBuildSetupLutTransaction(service, {
        networkId: 'sol--101',
        provider: 'kamino',
        marketAddress: 'Market',
        reserveAddress: 'Reserve',
        collateralReserveAddress: 'Collateral',
        accountId: 'account-1',
        expectedAccountAddress: 'AddressA',
      }),
    ).rejects.toThrow('Borrow account changed');
    expect(post).not.toHaveBeenCalled();
  });

  it.each(['setup', 'quote', 'repay'] as const)(
    'accepts an equivalent EVM address without forwarding the expected owner for %s',
    async (action) => {
      getAccountAddressForApi.mockReset();
      getAccountAddressForApi.mockResolvedValueOnce('0xAbCd');
      post.mockResolvedValue({ data: { data: transaction } });
      const base = {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        reserveAddress: '0xRESERVE',
        collateralReserveAddress: '0xCOLLATERAL',
        accountId: 'account-1',
        expectedAccountAddress: '0xabcd',
      };
      if (action === 'setup')
        await borrowBuildSetupLutTransaction(service, base);
      else if (action === 'quote')
        await getBorrowRepayWithCollateralQuote(service, {
          ...base,
          amount: '1',
        });
      else
        await borrowBuildRepayWithCollateralTransaction(service, {
          ...base,
          amount: '1',
        });
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][1]).toEqual(
        expect.objectContaining({ accountAddress: '0xAbCd' }),
      );
      expect(post.mock.calls[0][1]).not.toHaveProperty(
        'expectedAccountAddress',
      );
    },
  );

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

  it('loads reserve details with an optional account address', async () => {
    const details = { reserveAddress: '0xreserve' };
    get.mockResolvedValue({ data: { data: details } });

    await expect(
      getBorrowReserveDetails(service, {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMARKET',
        reserveAddress: '0xRESERVE',
        accountId: 'account-1',
      }),
    ).resolves.toEqual(details);

    expect(get).toHaveBeenCalledWith('/earn/v1/borrow/reserve-detail', {
      params: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        accountAddress,
      },
    });
  });

  it.each([
    {
      call: () =>
        borrowBuildSupplyTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          amount: '1',
        }),
      path: '/earn/v1/borrow/build-supply-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        amount: '1',
        accountAddress,
      },
    },
    {
      call: () =>
        borrowBuildRepayTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          amount: '2',
          repayAll: true,
        }),
      path: '/earn/v1/borrow/build-repay-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        reserveAddress: '0xreserve',
        amount: '2',
        accountAddress,
        repayAll: true,
      },
    },
    {
      call: () =>
        borrowBuildSetupLutTransaction(service, {
          networkId: 'sol--101',
          provider: 'kamino',
          marketAddress: 'Market',
          reserveAddress: 'Reserve',
          collateralReserveAddress: 'Collateral',
          accountId: 'account-1',
        }),
      path: '/earn/v1/borrow/build-setup-lut-transaction',
      request: {
        networkId: 'sol--101',
        provider: 'kamino',
        marketAddress: 'Market',
        reserveAddress: 'Reserve',
        collateralReserveAddress: 'Collateral',
        accountAddress,
      },
    },
    {
      call: () =>
        borrowBuildClaimTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          accountId: 'account-1',
          ids: ['reward-1'],
        }),
      path: '/earn/v1/borrow/build-claim-transaction',
      request: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        ids: ['reward-1'],
        accountAddress,
      },
    },
  ])('builds deferred borrow action through $path', async (testCase) => {
    post.mockResolvedValue({ data: { data: transaction } });

    await expect(testCase.call()).resolves.toEqual(transaction);
    expect(post).toHaveBeenCalledWith(testCase.path, testCase.request);
  });

  it.each([
    {
      call: () =>
        getBorrowRepayWithCollateralQuote(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          collateralReserveAddress: '0xCOLLATERAL',
          accountId: 'account-1',
          amount: '3.00',
          repayAll: true,
          slippageBps: 50,
        }),
      path: '/earn/v1/borrow/repay-with-collateral/quote',
    },
    {
      call: () =>
        borrowBuildRepayWithCollateralTransaction(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          collateralReserveAddress: '0xCOLLATERAL',
          accountId: 'account-1',
          amount: '3.00',
          repayAll: true,
          slippageBps: 50,
          routeKey: 'route-1',
        }),
      path: '/earn/v1/borrow/build-repay-with-collateral-transaction',
    },
  ])('normalizes collateral repayment through $path', async (testCase) => {
    post.mockResolvedValue({ data: { data: transaction } });

    await expect(testCase.call()).resolves.toEqual(transaction);
    expect(post).toHaveBeenCalledWith(testCase.path, {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: '0xmarket',
      reserveAddress: '0xreserve',
      collateralReserveAddress: '0xcollateral',
      repayAll: true,
      slippageBps: 50,
      ...(testCase.path.includes('build-') ? { routeKey: 'route-1' } : {}),
      accountAddress,
      amount: '3',
    });
  });

  it.each([
    {
      call: () =>
        getBorrowManagePage(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          reserveAddress: '0xRESERVE',
          accountId: 'account-1',
          type: 'borrow',
        }),
      path: '/earn/v1/borrow/manage-page',
      extra: { reserveAddress: '0xreserve', type: 'borrow' },
    },
    {
      call: () =>
        getBorrowHealthFactor(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          accountId: 'account-1',
        }),
      path: '/earn/v1/borrow/health-factor',
      extra: {},
    },
    {
      call: () =>
        getBorrowRewards(service, {
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0xMARKET',
          accountId: 'account-1',
        }),
      path: '/earn/v1/borrow/rewards',
      extra: {},
    },
  ])('loads deferred borrow data from $path', async (testCase) => {
    const data = { ok: true };
    get.mockResolvedValue({ data: { data } });

    await expect(testCase.call()).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith(testCase.path, {
      params: {
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xmarket',
        ...testCase.extra,
        accountAddress,
      },
    });
  });
});
