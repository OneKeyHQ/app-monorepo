import { isEmpty } from 'lodash';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcInput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import type {
  ICoreApiSignAccount,
  ICoreApiSignBtcExtraInfo,
  ISignedTxPro,
  ITxInputToSign,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { IBtcUTXOInfo, ICollectUTXOsOptions } from './types';
import type { IDBAccount, IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  ITransferInfo,
  IVaultSettings,
} from '../../types';

// btc vault
export default class VaultBtc extends VaultBase {
  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override settings: IVaultSettings = settings;

  override async buildEncodedTx(options: {
    transfersInfo: ITransferInfo[] | undefined;
  }): Promise<IEncodedTxBtc> {
    const { transfersInfo } = options;
    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(transfersInfo);
    }
    throw new OneKeyInternalError();
  }

  override async buildUnsignedTx(options: {
    transfersInfo: ITransferInfo[] | undefined;
  }): Promise<IUnsignedTxPro> {
    const { transfersInfo } = options;
    const encodedTx = await this.buildEncodedTx({ transfersInfo });
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx);
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(options: {
    unsignedTx: IUnsignedTxPro;
    feeInfo?: IFeeInfoUnit | undefined;
  }): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = options;
    if (feeInfo) {
      unsignedTx.feeInfo = feeInfo;
      return unsignedTx;
    }

    throw new OneKeyInternalError();
  }

  async getBtcForkNetwork() {
    return getBtcForkNetwork(await this.getNetworkImpl());
  }

  async validateAddress(address: string) {
    return validateBtcAddress({
      address,
      network: await this.getBtcForkNetwork(),
    });
  }

  private parseAddressEncodings(
    addresses: string[],
  ): Promise<Array<EAddressEncodings | undefined>> {
    return Promise.all(
      addresses.map((address) => this.validateAddress(address)),
    ).then((results) => results.map((i) => i.encoding));
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async _buildEncodedTxFromTransfer(
    transfersInfo: ITransferInfo[],
  ): Promise<IEncodedTxBtc> {
    const network = await this.getNetwork();
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      return {
        inputs: [],
        outputs: [],
      };
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(
    transfersInfo: ITransferInfo[],
  ): Promise<IEncodedTxBtc> {
    throw new NotImplemented();
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxBtc,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      encodedTx,
      feeInfo: undefined,
    });
  }

  async collectTxs(txids: string[]): Promise<{
    [txid: string]: string; // rawTx string
  }> {
    // const blockbook = await this.blockbook;
    const lookup: {
      [txid: string]: string; // rawTx string
    } = {};

    // for (let i = 0, batchSize = 5; i < txids.length; i += batchSize) {
    //   const batchTxids = txids.slice(i, i + batchSize);
    //   const txs = await Promise.all(
    //     batchTxids.map((txid) => blockbook.getRawTransaction(txid)),
    //   );
    //   batchTxids.forEach((txid, index) => (lookup[txid] = txs[index]));
    // }
    return lookup;
  }

  async collectUTXOsInfoByApi(
    options: ICollectUTXOsOptions = {},
  ): Promise<IBtcUTXOInfo> {
    // .get(`/api/v2/utxo/${xpub}`)
    return Promise.resolve({
      utxos: [],
    });
  }

  async getRelPathToAddressByBlockbookApi({
    addresses,
    account,
  }: {
    addresses: string[];
    account: IDBAccount;
  }) {
    // return this.baseSignTransactionByChainApiBtc(unsignedTx, options);

    const { utxos } = await this.collectUTXOsInfoByApi({
      checkInscription: false,
    });

    const pathToAddresses: {
      [path: string]: {
        address: string;
        relPath: string;
      };
    } = {};

    // add all matched addresses from utxos
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        const relPath = path.split('/').slice(-2).join('/');
        pathToAddresses[path] = {
          address,
          relPath,
        };
      }
    }

    // always add first account (path=0/0) address
    const firstRelPath = '0/0';
    const firstFullPath = [account.path, firstRelPath].join('/');
    if (!pathToAddresses[firstFullPath]) {
      pathToAddresses[firstFullPath] = {
        address: account.address,
        relPath: firstRelPath,
      };
    }

    const relPaths: string[] = Object.values(pathToAddresses).map(
      (item) => item.relPath,
    );

    return {
      relPaths,
      pathToAddresses,
    };
  }

  async collectInfoForSoftwareSign(
    unsignedTx: IUnsignedTxPro,
  ): Promise<[Array<EAddressEncodings | undefined>, Record<string, string>]> {
    const { inputs } = unsignedTx.encodedTx as IEncodedTxBtc;

    const inputAddressesEncodings = await this.parseAddressEncodings(
      inputs.map((i) => i.address),
    );

    const nonWitnessInputPrevTxids = Array.from(
      new Set(
        inputAddressesEncodings
          .map((encoding, index) => {
            if (encoding === EAddressEncodings.P2PKH) {
              return checkIsDefined(inputs[index]).txid;
            }
            return undefined;
          })
          .filter((i) => !!i) as string[],
      ),
    );

    const nonWitnessPrevTxs = await this.collectTxs(nonWitnessInputPrevTxids);

    return [inputAddressesEncodings, nonWitnessPrevTxs];
  }

  async prepareBtcSignExtraInfo({
    unsignedTx,
    unsignedMessage,
  }: {
    unsignedTx?: IUnsignedTxPro;
    unsignedMessage?: IUnsignedMessage;
  }): Promise<{
    account: ICoreApiSignAccount;
    btcExtraInfo: ICoreApiSignBtcExtraInfo;
  }> {
    const dbAccount = await this.getDbAccount();

    let addresses: string[] = [];
    if (unsignedMessage) {
      addresses = [dbAccount.address];
    }
    if (unsignedTx) {
      const emptyInputs: Array<ITxInputToSign | IBtcInput> = [];
      addresses = emptyInputs
        .concat(
          unsignedTx.inputsToSign ?? [],
          (unsignedTx.encodedTx as IEncodedTxBtc)?.inputs ?? [],
        )
        .filter(Boolean)
        .map((input) => input.address)
        .concat(dbAccount.address);
    }

    const {
      // required for multiple address signing
      relPaths,
      pathToAddresses,
    } = await this.getRelPathToAddressByBlockbookApi({
      addresses,
      account: dbAccount,
    });

    const btcExtraInfo: ICoreApiSignBtcExtraInfo = {
      pathToAddresses,
    };

    if (unsignedTx) {
      const [inputAddressesEncodings, nonWitnessPrevTxs] =
        await this.collectInfoForSoftwareSign(unsignedTx);
      btcExtraInfo.inputAddressesEncodings = inputAddressesEncodings;
      btcExtraInfo.nonWitnessPrevTxs = nonWitnessPrevTxs;
    }

    const account: ICoreApiSignAccount = {
      ...dbAccount,
      relPaths,
    };

    return { btcExtraInfo, account };
  }
}
