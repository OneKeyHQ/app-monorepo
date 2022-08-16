/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Solana,
  Provider as SolanaProvider,
} from '@onekeyfe/blockchain-libs/dist/provider/chains/sol';
import { ed25519 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { IDecodedTxActionType, IDecodedTxStatus } from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { INativeTxSol } from './types';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private async getClient(): Promise<Solana> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Solana;
  }

  // Chain only methods

  override createClientFromURL(url: string): Solana {
    return new Solana(url);
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.engine.providerManager.getTokenInfos(
      this.networkId,
      tokenAddresses,
    );
  }

  override validateAddress(address: string): Promise<string> {
    try {
      if (PublicKey.isOnCurve(address)) {
        return Promise.resolve(address);
      }
    } catch {
      // pass
    }
    throw new InvalidAddress();
  }

  override validateImportedCredential(input: string): Promise<boolean> {
    if (this.settings.importedAccountEnabled) {
      try {
        const secret = bs58.decode(input);
        if (secret.length === 64) {
          const [priv, pub] = [secret.slice(0, 32), secret.slice(32)];
          return Promise.resolve(
            ed25519.publicFromPrivate(priv).toString('hex') ===
              pub.toString('hex'),
          );
        }
      } catch {
        // pass
      }
    }
    return Promise.resolve(false);
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.watchingAccountEnabled) {
      try {
        await this.validateAddress(input);
        ret = true;
      } catch {
        // pass
      }
    }
    return Promise.resolve(ret);
  }

  // Account related methods

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTx,
    payload?: any,
  ): Promise<IDecodedTx> {
    const { address: fromAddress } =
      (await this.getDbAccount()) as DBSimpleAccount;
    return Promise.resolve({
      txid: '',
      owner: fromAddress,
      signer: fromAddress,
      nonce: 0,
      actions: [{ type: IDecodedTxActionType.UNKNOWN }],

      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
    });
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    const { from, to, amount, token: tokenAddress } = transferInfo;
    const network = await this.getNetwork();
    const client = await this.getClient();
    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress ?? '',
    );
    if (!token) {
      throw new OneKeyInternalError(
        `Token not found: ${tokenAddress || 'main'}`,
      );
    }

    const feePayer = new PublicKey(from);
    const receiver = new PublicKey(to);
    const nativeTx = new Transaction();
    [, nativeTx.recentBlockhash] = await client.getFees();
    nativeTx.feePayer = feePayer;

    if (tokenAddress) {
      const mint = new PublicKey(tokenAddress);
      let associatedTokenAddress = receiver;
      if (PublicKey.isOnCurve(receiver.toString())) {
        // system account, get token receiver address
        associatedTokenAddress = await getAssociatedTokenAddress(
          mint,
          receiver,
        );
      }
      const associatedAccountInfo = await client.getAccountInfo(
        associatedTokenAddress.toString(),
      );
      if (associatedAccountInfo === null) {
        nativeTx.add(
          createAssociatedTokenAccountInstruction(
            feePayer,
            associatedTokenAddress,
            receiver,
            mint,
          ),
        );
      }
      nativeTx.add(
        createTransferCheckedInstruction(
          await getAssociatedTokenAddress(mint, feePayer),
          mint,
          associatedTokenAddress,
          feePayer,
          BigInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
          token.decimals,
        ),
      );
    } else {
      nativeTx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(from),
          toPubkey: new PublicKey(to),
          lamports: BigInt(
            new BigNumber(amount).shiftedBy(token.decimals).toFixed(),
          ),
        }),
      );
    }

    return bs58.encode(nativeTx.serializeMessage());
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as Transaction;
    const client = await this.getClient();

    return {
      inputs: [],
      outputs: [],
      payload: {
        nativeTx,
        feePayer: new PublicKey(dbAccount.pub),
      },
      encodedTx,
    };
  }

  override async fetchFeeInfo(encodedTx: IEncodedTx): Promise<IFeeInfo> {
    const [network, prices, nativeTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasPrice(this.networkId),
      this.helper.parseToNativeTx(encodedTx),
    ]);

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      // The first byte of message is numRequiredSignatures
      limit: (nativeTx as INativeTxSol).serializeMessage()[0].toString(),
      prices,
      defaultPresetIndex: '0',

      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58.encode(
        Buffer.concat([
          decrypt(password, encryptedPrivateKey),
          bs58.decode(dbAccount.pub),
        ]),
      );
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }
}
