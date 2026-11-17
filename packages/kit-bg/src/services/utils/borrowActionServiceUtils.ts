// Loaded only through ServiceStaking background-method calls so user-triggered
// borrow actions do not increase the native background startup graph.
import BigNumber from 'bignumber.js';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IBorrowCheckAmount,
  IBorrowEModeStatus,
  IBorrowEModeSwitchCheck,
  IBorrowEstimateFee,
  IBorrowHealthFactor,
  IBorrowManagePage,
  IBorrowReserveDetail,
  IBorrowRewards,
  IBorrowTransactionConfirmation,
  IBorrowUnsignedTransaction,
  IRepayWithCollateralQuote,
} from '@onekeyhq/shared/types/staking';

import type { AxiosInstance } from 'axios';

export type IBorrowActionServiceContext = {
  backgroundApi: {
    serviceAccount: {
      getAccountAddressForApi: (params: {
        networkId: string;
        accountId: string;
      }) => Promise<string>;
    };
  };
  getClient: (name: EServiceEndpointEnum) => Promise<AxiosInstance>;
};

export async function getBorrowTransactionConfirmation(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    action:
      | 'supply'
      | 'withdraw'
      | 'borrow'
      | 'repay'
      | 'repayWithCollateral'
      | 'setCollateral';
    amount: string;
    withdrawAll?: boolean;
    repayAll?: boolean;
    useAsCollateral?: boolean;
    eModeId?: number;
    collateralReserveAddress?: string;
    slippageBps?: number;
  },
) {
  const { accountId, amount, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const amountNumber = BigNumber(amount || 0);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    data: IBorrowTransactionConfirmation;
  }>('/earn/v1/borrow/transaction-confirmation', {
    params: {
      ...rest,
      amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
      accountAddress,
    },
  });
  return response.data.data;
}

export async function borrowBuildWithdrawTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    amount: string;
    withdrawAll?: boolean;
    unwrap?: boolean;
  },
) {
  const { accountId, withdrawAll, unwrap, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-withdraw-transaction', {
    ...rest,
    accountAddress,
    ...(withdrawAll !== undefined ? { withdrawAll } : {}),
    ...(unwrap !== undefined ? { unwrap } : {}),
  });
  return response.data.data;
}

export async function borrowBuildBorrowTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    amount: string;
    unwrap?: boolean;
  },
) {
  const { accountId, unwrap, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-borrow-transaction', {
    ...rest,
    accountAddress,
    ...(unwrap !== undefined ? { unwrap } : {}),
  });
  return response.data.data;
}

export async function borrowBuildApproveDelegationTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-approve-delegation-transaction', {
    ...rest,
    accountAddress,
  });
  return response.data.data;
}

export async function getBorrowEModeStatus(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{ data: IBorrowEModeStatus }>(
    '/earn/v1/borrow/e-mode/status',
    { params: { ...rest, accountAddress } },
  );
  return response.data.data;
}

export async function borrowSwitchCheckEMode(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
    targetEModeId: number;
    autoHandleError?: boolean;
  },
) {
  const { accountId, autoHandleError, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const requestConfig:
    | (Parameters<typeof client.post>[2] & {
        autoHandleError?: boolean;
      })
    | undefined =
    autoHandleError === false ? { autoHandleError: false } : undefined;
  const response = await client.post<{
    code: number;
    message: string;
    data: IBorrowEModeSwitchCheck;
  }>(
    '/earn/v1/borrow/e-mode/switch-check',
    { ...rest, accountAddress },
    requestConfig,
  );
  return response.data;
}

export async function borrowBuildSetEModeTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
    eModeId: number;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{ data: IBorrowUnsignedTransaction }>(
    '/earn/v1/borrow/build-set-emode-transaction',
    { ...rest, accountAddress },
  );
  return response.data.data;
}

export async function borrowBuildSetCollateralTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
    reserveAddress: string;
    useAsCollateral: boolean;
    eModeId?: number;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{ data: IBorrowUnsignedTransaction }>(
    '/earn/v1/borrow/build-set-collateral-transaction',
    { ...rest, accountAddress },
  );
  return response.data.data;
}

export async function getBorrowCheckAmount(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    action: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'repayWithCollateral';
    amount: string;
    repayAll?: boolean;
    collateralReserveAddress?: string;
  },
) {
  const { accountId, amount, repayAll, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const amountNumber = BigNumber(amount || 0);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    code: number;
    message: string;
    data: IBorrowCheckAmount;
  }>('/earn/v1/borrow/check-amount', {
    params: {
      ...rest,
      amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
      accountAddress,
      ...(repayAll !== undefined ? { repayAll } : {}),
    },
  });
  return response.data;
}

export async function getBorrowEstimateFee(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    action: 'supply' | 'withdraw' | 'borrow' | 'repay';
    amount: string;
    withdrawAll?: boolean;
    repayAll?: boolean;
  },
) {
  const { accountId, amount, withdrawAll, repayAll, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const amountNumber = BigNumber(amount || 0);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    code: number;
    message: string;
    data: IBorrowEstimateFee;
  }>('/earn/v1/borrow/estimate-fee', {
    params: {
      ...rest,
      amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
      ...(withdrawAll !== undefined ? { withdrawAll } : {}),
      ...(repayAll !== undefined ? { repayAll } : {}),
      accountAddress,
    },
  });
  return response.data.data;
}

export async function getBorrowReserveDetails(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId?: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress = accountId
    ? await service.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId: params.networkId,
        accountId,
      })
    : undefined;
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    data: IBorrowReserveDetail;
  }>('/earn/v1/borrow/reserve-detail', {
    params: {
      ...rest,
      ...(accountAddress ? { accountAddress } : {}),
    },
  });
  return response.data.data;
}

export async function borrowBuildSupplyTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    amount: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-supply-transaction', {
    ...rest,
    accountAddress,
  });
  return response.data.data;
}

export async function borrowBuildRepayTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    amount: string;
    repayAll?: boolean;
  },
) {
  const { accountId, repayAll, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-repay-transaction', {
    ...rest,
    accountAddress,
    ...(repayAll !== undefined ? { repayAll } : {}),
  });
  return response.data.data;
}

export async function getBorrowRepayWithCollateralQuote(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    collateralReserveAddress: string;
    accountId: string;
    amount: string;
    repayAll?: boolean;
    slippageBps?: number;
  },
) {
  const { accountId, amount, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const amountNumber = BigNumber(amount || 0);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IRepayWithCollateralQuote;
  }>('/earn/v1/borrow/repay-with-collateral/quote', {
    ...rest,
    accountAddress,
    amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
  });
  return response.data.data;
}

export async function borrowBuildRepayWithCollateralTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    collateralReserveAddress: string;
    accountId: string;
    amount: string;
    repayAll?: boolean;
    slippageBps?: number;
    routeKey?: string;
  },
) {
  const { accountId, amount, ...rest } =
    earnUtils.normalizeBorrowAddressParams(params);
  const amountNumber = BigNumber(amount || 0);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-repay-with-collateral-transaction', {
    ...rest,
    accountAddress,
    amount: amountNumber.isNaN() ? '0' : amountNumber.toFixed(),
  });
  return response.data.data;
}

export async function borrowBuildSetupLutTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    collateralReserveAddress: string;
    accountId: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-setup-lut-transaction', {
    ...rest,
    accountAddress,
  });
  return response.data.data;
}

export async function borrowBuildClaimTransaction(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
    ids: string[];
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.post<{
    data: IBorrowUnsignedTransaction;
  }>('/earn/v1/borrow/build-claim-transaction', {
    ...rest,
    accountAddress,
  });
  return response.data.data;
}

export async function getBorrowManagePage(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    accountId: string;
    type: 'supply' | 'withdraw' | 'borrow' | 'repay';
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    data: IBorrowManagePage;
  }>('/earn/v1/borrow/manage-page', {
    params: {
      ...rest,
      accountAddress,
    },
  });
  return response.data.data;
}

export async function getBorrowHealthFactor(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    data: IBorrowHealthFactor;
  }>('/earn/v1/borrow/health-factor', {
    params: {
      ...rest,
      accountAddress,
    },
  });
  return response.data.data;
}

export async function getBorrowRewards(
  service: IBorrowActionServiceContext,
  params: {
    networkId: string;
    provider: string;
    marketAddress: string;
    accountId: string;
  },
) {
  const { accountId, ...rest } = earnUtils.normalizeBorrowAddressParams(params);
  const accountAddress =
    await service.backgroundApi.serviceAccount.getAccountAddressForApi({
      networkId: params.networkId,
      accountId,
    });
  const client = await service.getClient(EServiceEndpointEnum.Earn);
  const response = await client.get<{
    data: IBorrowRewards;
  }>('/earn/v1/borrow/rewards', {
    params: {
      ...rest,
      accountAddress,
    },
  });
  return response.data.data;
}
