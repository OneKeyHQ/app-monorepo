/* eslint-disable max-classes-per-file */

import { ethers } from 'ethers';

import type {
  ICoreHyperLiquidAgentCredential,
  IUnsignedMessage,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import localDb from '../../dbs/local/localDb';
import ServiceBase from '../ServiceBase';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

type IHyperLiquidAgentCredentialInfo = Omit<
  ICoreHyperLiquidAgentCredential,
  'privateKey'
>;

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
  private readonly agentAddress: string;

  private readonly agentName: ICoreHyperLiquidAgentCredential['agentName'];

  private readonly userAddress: string;

  constructor({
    agentAddress,
    agentName,
    userAddress,
  }: Pick<
    IHyperLiquidAgentCredentialInfo,
    'agentAddress' | 'agentName' | 'userAddress'
  >) {
    this.agentAddress = agentAddress;
    this.agentName = agentName;
    this.userAddress = userAddress;
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
    const credential = await localDb.getHyperLiquidAgentCredential({
      agentName: this.agentName,
      userAddress: this.userAddress,
    });
    if (!credential?.privateKey) {
      throw new OneKeyLocalError(
        'HyperLiquid agent credential is unavailable; unlock the app again',
      );
    }
    // Keep the raw private key and ethers wallet scoped to one signature. JS
    // strings cannot be reliably overwritten, but neither value is retained by
    // the long-lived Exchange Client after this method resolves.
    const wallet = new ethers.Wallet(credential.privateKey);
    // Fail closed if the fetched key does not derive the advertised agent
    // address: a stale proxy after re-approval or an inconsistent record must
    // never silently sign with a key that mismatches the agent identity this
    // proxy advertises, which would desync the exchange client.
    if (wallet.address.toLowerCase() !== this.agentAddress.toLowerCase()) {
      throw new OneKeyLocalError(
        'HyperLiquid agent credential does not match the active agent address; re-enable trading',
      );
    }
    return wallet._signTypedData(domain, types, value);
  }

  async getAddress(): Promise<IHex> {
    return this.agentAddress as IHex;
  }

  provider = null;
}

export class WalletHyperliquidOnekey implements IAbstractEthersV6Signer {
  accountId: string;

  backgroundApi: IBackgroundApi;

  private _tempSignature?: {
    value: Record<string, unknown>;
    signatureHex: string;
    signerAddress: string;
  };

  constructor(accountId: string, backgroundApi: IBackgroundApi) {
    this.accountId = accountId;
    this.backgroundApi = backgroundApi;
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
        EIP712Domain: [
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
    if (!address) {
      throw new OneKeyLocalError({
        message: `Failed to get address for account ${this.accountId}`,
      });
    }
    const unsignedMessage: IUnsignedMessage = {
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(typedDataPayload),
      payload: [address, JSON.stringify(typedDataPayload)],
    };

    const result = await this.backgroundApi.serviceSend.signMessage({
      unsignedMessage,
      accountId: this.accountId,
      networkId: PERPS_NETWORK_ID,
      useNonBlockingKdf: true,
    });

    if (!result || typeof result !== 'string') {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.global_unknown_error,
        }),
      });
    }

    this._tempSignature = {
      value,
      signatureHex: result,
      signerAddress: address,
    };
    return result;
  }

  getTempSignatureAndClear() {
    const temp = this._tempSignature;
    this._tempSignature = undefined;
    return temp;
  }

  async getAddress(): Promise<string> {
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId: this.accountId,
      networkId: PERPS_NETWORK_ID,
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

  // TODO remove cache
  private onekeyWalletCache = new Map<string, WalletHyperliquidOnekey>();

  @backgroundMethod()
  async getProxyWallet(params: {
    agentCredential?: IHyperLiquidAgentCredentialInfo;
  }): Promise<{
    address: IHex;
    wallet: WalletHyperliquidProxy;
  }> {
    if (!params.agentCredential) {
      throw new OneKeyLocalError({
        message: `Failed to get agent credential`,
      });
    }
    const wallet = new WalletHyperliquidProxy({
      agentAddress: params.agentCredential.agentAddress,
      agentName: params.agentCredential.agentName,
      userAddress: params.agentCredential.userAddress,
    });
    const address = await wallet.getAddress();
    return {
      address,
      wallet,
    };
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
