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
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IXpubValidation } from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

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
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildTxHelperParams,
  IBuildUnsignedTxParams,
  ITransferInfo,
  IVaultSettings,
} from '../../types';

// btc vault
export default class VaultBtc extends VaultBase {
  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    noopObject(params);
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    console.log('VaultBtc broadcastTransaction', params, {
      rawTxOk:
        params.signedTx.rawTx ===
        '0200000000010190ed799b5a2d54a743f8c405615ddada3823b2cc1c178a77a15f5e18de45cb390100000000ffffffff02e80300000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c6f00e02000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c601402a5758f1759557b6b7a02900339f5ed83984e26a24e22b642f7a3bcd89a13392cf0848d29eb6be2e18e2c040969c37bd44825f8a343db8c530229c0aceecf88200000000',
      txidOk:
        params.signedTx.txid ===
        '17eafe9b6ca10dbdb70f8f37460db13401cccd9cc2bcb4851a31f01799688dd3',
    });
    throw new Error('Method not implemented.');
  }

  override settings: IVaultSettings = settings;

  override async buildEncodedTx(
    params: IBuildEncodedTxParams & IBuildTxHelperParams,
  ): Promise<IEncodedTxBtc> {
    const { transfersInfo } = params;
    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(transfersInfo);
    }
    throw new OneKeyInternalError();
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams & IBuildTxHelperParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async validateXpub(_xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string) {
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
    // const network = await this.getNetwork();
    if (transfersInfo.length === 1) {
      // const transferInfo = transfersInfo[0];
      return {
        inputs: [
          {
            // TBTC: zoo zoo ... vote(24 words), HD wallet,  first taproot address
            address:
              'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
            path: "m/86'/1'/0'/0/0",
            txid: '39cb45de185e5fa1778a171cccb22338dada5d6105c4f843a7542d5a9b79ed90',
            value: '136122',
            vout: 1,
          },
        ],
        outputs: [
          {
            address:
              'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
            value: '1000',
          },
          {
            address:
              'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr',
            value: '134896',
          },
        ],
      };
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(
    transfersInfo: ITransferInfo[],
  ): Promise<IEncodedTxBtc> {
    console.log(transfersInfo);
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
    console.log(txids);
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
    console.log(options);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override getPrivateKeyFromImported(params: {
    input: string;
  }): Promise<{ privateKey: string }> {
    throw new NotImplemented();
  }
}
