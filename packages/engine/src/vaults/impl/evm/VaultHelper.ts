import { isNil, isString } from 'lodash';

import { VaultHelperBase } from '../../VaultHelperBase';

import { ethersTxToJson, jsonToEthersTx } from './decoder/util';
import { ethers } from './sdk/ethers';

import type { IEncodedTxEvm } from './Vault';

/*
await $backgroundApiProxy.backgroundApi.engine.vaultFactory.lastVault.helper.decodeToNativeTx("0xf86b018502540be40082520894a9b4d559a98ff47c83b74522b7986146538cd4df861b48eb57e0008081e5a06f021ecfb345b8122561c751acdc8c0516632442065c2dc6867c2b19054539dca022f230825979a211d70d4488888d6a3ed9d9c12667e15a6d90df6e5a7a48b440")

await $backgroundApiProxy.backgroundApi.engine.vaultFactory.lastVault.helper.decodeToNativeTx({
data: "0x",
from: "0xa9b4d559a98ff47c83b74522b7986146538cd4df",
gas: "21000",
gasPrice: "5",
to: "0xa9b4d559a98ff47c83b74522b7986146538cd4df",
value: "0x1508356912000",
})
 */

function toBigNumberField(
  value?: string,
  defaultValue?: string,
): ethers.BigNumber {
  try {
    if (value === '0x' || value === '' || isNil(value)) {
      if (defaultValue === undefined) {
        // @ts-ignore
        return undefined;
      }
      return ethers.BigNumber.from(defaultValue);
    }
    return ethers.BigNumber.from(value);
  } catch (error) {
    return ethers.BigNumber.from('0');
  }
}

export default class VaultHelper extends VaultHelperBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseToNativeTx(
    encodedTx: IEncodedTxEvm,
  ): Promise<ethers.Transaction | null> {
    // TODO try catch
    let ethersTx: ethers.Transaction | null = null;
    // parse rawTx string
    if (isString(encodedTx)) {
      ethersTx = ethers.utils.parseTransaction(encodedTx);
      ethersTx = {
        ...ethersTx,
        from: ethersTx.from?.toLocaleLowerCase(),
        to: ethersTx.to?.toLocaleLowerCase(),
      };
    } else {
      // @ts-ignore
      ethersTx = {
        ...encodedTx,
        gasLimit: toBigNumberField(encodedTx.gasLimit ?? encodedTx.gas, '0'),
        gasPrice: toBigNumberField(encodedTx.gasPrice),
        value: toBigNumberField(encodedTx.value, '0'),
        maxPriorityFeePerGas: toBigNumberField(encodedTx.maxPriorityFeePerGas),
        maxFeePerGas: toBigNumberField(encodedTx.maxFeePerGas),
      };
      // @ts-ignore
      delete ethersTx?.gas;
    }

    return Promise.resolve(ethersTx);
  }

  override async parseToEncodedTx(
    rawTxOrEncodedTx: IEncodedTxEvm,
  ): Promise<IEncodedTxEvm | null> {
    if (!rawTxOrEncodedTx) {
      return null;
    }
    const nativeTx = await this.parseToNativeTx(rawTxOrEncodedTx);
    if (!nativeTx) {
      return null;
    }

    return {
      ...nativeTx,
      from: nativeTx.from ?? '',
      to: nativeTx.to ?? '',
      value: nativeTx.value.toString(),
      gasLimit: nativeTx.gasLimit?.toString(),
      gasPrice: nativeTx.gasPrice?.toString(),
      maxFeePerGas: nativeTx.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: nativeTx.maxPriorityFeePerGas?.toString(),
    };
  }

  override nativeTxToJson(nativeTx: ethers.Transaction): Promise<string> {
    return ethersTxToJson(nativeTx);
  }

  override jsonToNativeTx(json: string): Promise<ethers.Transaction> {
    return jsonToEthersTx(json);
  }
}
