/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
// @ts-expect-error
import coinSelect from 'coinselect';
// @ts-expect-error
import coinSelectSplit from 'coinselect/split';
import memoizee from 'memoizee';

import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { InsufficientBalance, OneKeyInternalError } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import { ITransferInfo } from '../../types';
import { VaultBase } from '../../VaultBase';

import { Provider } from './btcForkChainUtils/provider';
import {
  AddressEncodings,
  IBtcUTXO,
  IEncodedTxBtc,
  IUTXOInput,
  IUTXOOutput,
} from './btcForkChainUtils/types';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

const DEFAULT_BLOCK_NUMS = [5, 2, 1];

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      ret =
        this.settings.importedAccountEnabled &&
        /^[d]gpv/.test(input) &&
        (this.engineProvider as unknown as Provider).isValidXprv(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      ret =
        this.settings.watchingAccountEnabled &&
        /^[d]gub/.test(input) &&
        (this.engineProvider as unknown as Provider).isValidXpub(input);
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
  ): Promise<boolean> {
    let accountIsPresent = false;
    try {
      const provider = this.engineProvider as unknown as Provider;
      const { txs } = (await provider.getAccount({
        type: 'simple',
        xpub: accountIdOnNetwork,
      })) as {
        txs: number;
      };
      accountIsPresent = txs > 0;
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve(accountIsPresent);
  }

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const { xpub } = (await this.getDbAccount()) as DBUTXOAccount;
    if (!xpub) {
      return [new BigNumber('0'), ...ret];
    }
    const [mainBalance] = await this.getBalances([{ address: xpub }]);
    return [mainBalance].concat(ret);
  }

  override getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    return (this.engineProvider as unknown as Provider).getBalances(requests);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const addressEncoding = AddressEncodings.P2PKH;
      const { network } = this.engineProvider as unknown as Provider;
      const { private: xprvVersionBytes } = network.bip32;

      const keyring = this.keyring as KeyringHd;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }

    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }

    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeRate?: string,
  ): Promise<IEncodedTxBtc> {
    console.log(1);
    const { to, amount } = transferInfo;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const utxos = await this.collectUTXOs();
    // Select the slowest fee rate as default, otherwise the UTXO selection
    // would be failed.
    // SpecifiedFeeRate is from UI layer and is in BTC/byte, convert it to sats/byte
    const feeRate =
      typeof specifiedFeeRate !== 'undefined'
        ? new BigNumber(specifiedFeeRate)
            .shiftedBy(network.feeDecimals)
            .toFixed()
        : (await this.getFeeRate())[0];
    const max = utxos
      .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
      .shiftedBy(-network.decimals)
      .lte(amount);
    console.log(utxos);

    const unspentSelectFn = max ? coinSelectSplit : coinSelect;
    const {
      inputs,
      outputs,
      fee,
    }: {
      inputs: IUTXOInput[];
      outputs: IUTXOOutput[];
      fee: number;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } = unspentSelectFn(
      utxos.map(({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      })),
      [
        max
          ? { address: to }
          : {
              address: to,
              value: parseInt(
                new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
              ),
            },
      ],
      parseInt(feeRate),
    );

    if (!inputs || !outputs) {
      throw new InsufficientBalance('Failed to select UTXOs');
    }
    const totalFee = fee.toString();
    const totalFeeInNative = new BigNumber(totalFee)
      .shiftedBy(-1 * network.feeDecimals)
      .toFixed();
    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address }) => ({
        address: address || dbAccount.address, // change amount
        value: value.toString(),
      })),
      totalFee,
      totalFeeInNative,
      transferInfo,
    };
  }

  collectUTXOs = memoizee(
    async () => {
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      try {
        return await (this.engineProvider as unknown as Provider).getUTXOs(
          dbAccount.xpub,
        );
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get UTXOs of the account.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  private getFeeRate = memoizee(
    async () => {
      const client = await (this.engineProvider as unknown as Provider)
        .blockbook;
      try {
        return await Promise.all(
          DEFAULT_BLOCK_NUMS.map((blockNum) =>
            client
              .estimateFee(blockNum)
              .then((feeRate) => new BigNumber(feeRate).toFixed(0)),
          ),
        );
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get fee rates.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );
}
