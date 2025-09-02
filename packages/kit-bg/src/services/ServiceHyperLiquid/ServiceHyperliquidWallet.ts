/* eslint-disable max-classes-per-file */
import * as crypto from 'crypto';

import { Wallet } from 'ethers';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import ServiceBase from '../ServiceBase';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const CHAIN_ID = 'evm--42161'; // Arbitrum hex chainId

interface IAbstractEthersV6Signer {
  signTypedData(
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    },
    types: {
      [key: string]: {
        name: string;
        type: string;
      }[];
    },
    value: Record<string, unknown>,
  ): Promise<string>;
  getAddress(): Promise<string>;
  provider: any;
}

export class WalletHyperliquidProxy implements IAbstractEthersV6Signer {
  private wallet: Wallet;

  constructor(encryptedPrivateKey: string) {
    this.wallet = new Wallet(encryptedPrivateKey);
  }

  async signTypedData(
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    },
    types: {
      [key: string]: {
        name: string;
        type: string;
      }[];
    },
    value: Record<string, unknown>,
  ): Promise<string> {
    return this.wallet._signTypedData(domain, types, value);
  }

  async getAddress(): Promise<string> {
    return this.wallet.address;
  }

  provider = null;
}

export class WalletHyperliquidOnekey implements IAbstractEthersV6Signer {
  private instanceId: string;

  constructor(
    private accountId: string,
    private backgroundApi: IBackgroundApi,
  ) {
    this.instanceId = `onekey-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  async signTypedData(
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    },
    types: {
      [key: string]: {
        name: string;
        type: string;
      }[];
    },
    value: Record<string, unknown>,
  ): Promise<string> {
    const primaryType = Object.keys(types)[0];
    const typedDataPayload = {
      types: {
        'EIP712Domain': [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...types,
      },
      primaryType,
      domain,
      message: value,
    };

    const address = await this.getAddress();
    const unsignedMessage: IUnsignedMessage = {
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(typedDataPayload),
      payload: [address, JSON.stringify(typedDataPayload)],
    };

    const result = await this.backgroundApi.serviceSend.signMessage({
      unsignedMessage,
      accountId: this.accountId,
      networkId: CHAIN_ID,
    });

    if (!result || typeof result !== 'string') {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.global_unknown_error,
        }),
      });
    }

    return result;
  }

  async getAddress(): Promise<string> {
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId: this.accountId,
      networkId: CHAIN_ID,
    });
    return account.address;
  }

  provider = null;
}

@backgroundClass()
export default class ServiceHyperliquidWallet extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private onekeyWalletCache = new Map<string, WalletHyperliquidOnekey>();

  @backgroundMethod()
  async getProxyWallet(params: { userAddress: string }): Promise<{
    address: string;
    wallet: WalletHyperliquidProxy;
  }> {
    let credential =
      await this.backgroundApi.serviceAccount.getHyperLiquidAgentCredential({
        userAddress: params.userAddress,
        agentName: EHyperLiquidAgentName.Desktop,
      });

    if (!credential) {
      const privateKeyBytes = crypto.randomBytes(32);
      const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);

      const encodedPrivateKey =
        await this.backgroundApi.servicePassword.encodeSensitiveText({
          text: privateKeyHex,
        });

      await this.backgroundApi.serviceAccount.addHyperLiquidAgentCredential({
        userAddress: params.userAddress,
        agentName: EHyperLiquidAgentName.Desktop,
        privateKey: encodedPrivateKey,
      });
      credential = {
        userAddress: params.userAddress,
        agentName: EHyperLiquidAgentName.Desktop,
        privateKey: encodedPrivateKey,
      };
    }
    const wallet = new WalletHyperliquidProxy(credential.privateKey);
    const address = await wallet.getAddress();
    return {
      address,
      wallet,
    };
  }

  @backgroundMethod()
  async getProxyWalletAddress(params: {
    userAddress: string;
  }): Promise<string> {
    const proxyWallet = await this.getProxyWallet(params);
    return proxyWallet.address;
  }

  @backgroundMethod()
  async getOnekeyWallet(params: {
    userAccountId: string;
  }): Promise<WalletHyperliquidOnekey> {
    if (!this.onekeyWalletCache.has(params.userAccountId)) {
      const wallet = new WalletHyperliquidOnekey(
        params.userAccountId,
        this.backgroundApi,
      );
      this.onekeyWalletCache.set(params.userAccountId, wallet);
    }
    const wallet = this.onekeyWalletCache.get(params.userAccountId);
    if (!wallet) {
      throw new OneKeyLocalError({
        message: `Failed to get wallet for account ${params.userAccountId}`,
      });
    }
    return wallet;
  }

  async dispose(): Promise<void> {
    this.onekeyWalletCache.clear();
  }
}
