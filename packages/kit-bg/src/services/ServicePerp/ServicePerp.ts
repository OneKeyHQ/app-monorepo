import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  IHyperLiquidSignatureRSV,
  IHyperLiquidTypedDataApproveBuilderFee,
} from '@onekeyhq/shared/types/hyperliquid';

import ServiceBase from '../ServiceBase';

export interface IHyperliquidClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    position: {
      coin: string;
      entryPx?: string;
      leverage: {
        type: string;
        value: number;
      };
      liquidationPx?: string;
      marginUsed: string;
      maxLeverage: number;
      positionValue: string;
      returnOnEquity: string;
      szi: string;
      unrealizedPnl: string;
    };
    type: string;
  }>;
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  time: number;
}

export interface IHyperliquidSubAccount {
  name: string;
  subAccountUser: string;
  clearinghouseState: IHyperliquidClearinghouseState;
  spotState?: {
    balances: Array<{
      coin: string;
      total: string;
      hold: string;
    }>;
  };
}

export interface IHyperliquidUserFunding {
  coin: string;
  fundingRate: string;
  szi: string;
  usd: string;
  time: number;
}

export interface IHyperliquidLedgerUpdate {
  coin?: string;
  delta: string;
  hash: string;
  time: number;
  type: string;
}

export interface IHyperliquidVaultEquity {
  allTime: {
    pnl: string;
    vlm: string;
  };
  day: {
    pnl: string;
    vlm: string;
  };
  totalDeposited: string;
  totalWithdrawn: string;
  vault: string;
  vaultAddress: string;
  withdrawable: string;
}

export type IHyperliquidMaxBuilderFee = number;

export interface IHyperliquidApproveBuilderFeeRequest {
  userAddress: string;
  builderAddress: string;
  maxFeeRate: string;
  signature: IHyperLiquidSignatureRSV;
  nonce: number;
  vaultAddress?: string | null;
}

export interface IHyperliquidExchangeResponse {
  status: string;
  response: {
    type: string;
    data?: any;
  };
}

@backgroundClass()
class ServicePerp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async hyperliquidRequest<T>(body: Record<string, any>): Promise<T> {
    try {
      const response = await axios.post<T>(
        'https://api.hyperliquid.xyz/info',
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OneKeyError(
          `Hyperliquid API error: ${error.response?.status ?? 'unknown'} ${
            error.response?.statusText || error.message
          }`,
        );
      }
      throw new OneKeyError(
        `Hyperliquid API error: ${(error as Error).message}`,
      );
    }
  }

  private async hyperliquidExchangeRequest<T>(
    body: Record<string, any>,
  ): Promise<T> {
    try {
      const response = await axios.post<T>(
        'https://api.hyperliquid.xyz/exchange',
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OneKeyError(
          `Hyperliquid Exchange API error: ${
            error.response?.status ?? 'unknown'
          } ${error.response?.statusText || error.message}`,
        );
      }
      throw new OneKeyError(
        `Hyperliquid Exchange API error: ${(error as Error).message}`,
      );
    }
  }

  @backgroundMethod()
  async getClearinghouseState({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState> {
    return this.hyperliquidRequest<IHyperliquidClearinghouseState>({
      type: 'clearinghouseState',
      user: userAddress,
    });
  }

  @backgroundMethod()
  async getSubAccounts({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidSubAccount[]> {
    return this.hyperliquidRequest<IHyperliquidSubAccount[]>({
      type: 'subAccounts',
      user: userAddress,
    });
  }

  @backgroundMethod()
  async getUserFunding({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidUserFunding[]> {
    const requestBody: Record<string, any> = {
      type: 'userFunding',
      user: userAddress,
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidRequest<IHyperliquidUserFunding[]>(requestBody);
  }

  @backgroundMethod()
  async getUserNonFundingLedgerUpdates({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidLedgerUpdate[]> {
    const requestBody: Record<string, any> = {
      type: 'userNonFundingLedgerUpdates',
      user: userAddress,
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidRequest<IHyperliquidLedgerUpdate[]>(requestBody);
  }

  @backgroundMethod()
  async getUserVaultEquities({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidVaultEquity[]> {
    return this.hyperliquidRequest<IHyperliquidVaultEquity[]>({
      type: 'userVaultEquities',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    return this.hyperliquidRequest<IHyperliquidMaxBuilderFee>({
      type: 'maxBuilderFee',
      user: userAddress.toLowerCase(),
      builder: builderAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getAccountBalance({ userAddress }: { userAddress: string }): Promise<{
    accountValue: string;
    withdrawable: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  }> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return {
      accountValue: clearinghouse.marginSummary.accountValue,
      withdrawable: clearinghouse.withdrawable,
      totalMarginUsed: clearinghouse.marginSummary.totalMarginUsed,
      totalNtlPos: clearinghouse.marginSummary.totalNtlPos,
    };
  }

  @backgroundMethod()
  async getOpenPositions({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState['assetPositions']> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return clearinghouse.assetPositions.filter(
      (position) => parseFloat(position.position.szi) !== 0,
    );
  }

  @backgroundMethod()
  async getAccountSummary({ userAddress }: { userAddress: string }): Promise<{
    balance: {
      accountValue: string;
      withdrawable: string;
      totalMarginUsed: string;
      totalNtlPos: string;
    };
    openPositions: IHyperliquidClearinghouseState['assetPositions'];
    subAccounts: IHyperliquidSubAccount[];
  }> {
    const [balance, openPositions, subAccounts] = await Promise.all([
      this.getAccountBalance({ userAddress }),
      this.getOpenPositions({ userAddress }),
      this.getSubAccounts({ userAddress }),
    ]);

    return {
      balance,
      openPositions,
      subAccounts,
    };
  }

  @backgroundMethod()
  async approveBuilderFee({
    builderAddress,
    maxFeeRate,
    signature,
    nonce,
    vaultAddress = null,
  }: Omit<
    IHyperliquidApproveBuilderFeeRequest,
    'userAddress'
  >): Promise<IHyperliquidExchangeResponse> {
    const apiPayload = {
      action: {
        maxFeeRate,
        builder: builderAddress,
        nonce,
        type: 'approveBuilderFee',
      },
      nonce,
      signature,
      vaultAddress,
    };

    // Send request to both Hyperliquid API and HyperDash API
    const [hyperliquidResponse, _hyperDashResponse] = await Promise.allSettled([
      this.hyperliquidExchangeRequest<IHyperliquidExchangeResponse>(apiPayload),
      axios.post(
        'https://hyperdash.info/api/hyperliquid/exchange',
        apiPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    ]);

    // Return the primary response from Hyperliquid
    if (hyperliquidResponse.status === 'fulfilled') {
      return hyperliquidResponse.value;
    }

    // If primary fails but HyperDash succeeds, still throw the original error
    const errorMessage =
      hyperliquidResponse.status === 'rejected'
        ? (hyperliquidResponse.reason as Error)?.message || 'Unknown error'
        : 'Unknown error';

    throw new OneKeyError(`Failed to approve builder fee: ${errorMessage}`);
  }

  @backgroundMethod()
  async createApproveBuilderFeePayload({
    builderAddress,
    maxFeeRate,
    nonce,
  }: {
    builderAddress: string;
    maxFeeRate: string;
    nonce: number;
  }): Promise<{
    apiPayload: Record<string, any>;
    typedData: IHyperLiquidTypedDataApproveBuilderFee;
  }> {
    // Create EIP-712 typed data for signing
    const typedData: IHyperLiquidTypedDataApproveBuilderFee = {
      domain: {
        name: 'HyperliquidSignTransaction',
        version: '1',
        chainId: 42_161, // Arbitrum chainId
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      message: {
        hyperliquidChain: 'Mainnet',
        signatureChainId: '0xa4b1', // Arbitrum hex chainId
        maxFeeRate,
        builder: builderAddress,
        nonce,
        type: 'approveBuilderFee',
      },
      primaryType: 'HyperliquidTransaction:ApproveBuilderFee',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        'HyperliquidTransaction:ApproveBuilderFee': [
          { name: 'maxFeeRate', type: 'string' },
          { name: 'builder', type: 'address' },
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
    };

    const apiPayload = {
      action: {
        maxFeeRate,
        builder: builderAddress,
        nonce,
        type: 'approveBuilderFee',
      },
      nonce,
      vaultAddress: null,
    };

    return {
      apiPayload,
      typedData,
    };
  }

  parseSignatureToRSV(signature: string): IHyperLiquidSignatureRSV {
    // Remove 0x prefix if present
    const cleanSig = signature.replace(/^0x/, '');

    // Extract r, s, v components
    const r = `0x${cleanSig.slice(0, 64)}`;
    const s = `0x${cleanSig.slice(64, 128)}`;
    const v = parseInt(cleanSig.slice(128, 130), 16);

    return { r, s, v };
  }
}

export default ServicePerp;
