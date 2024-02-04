import bech32 from 'bech32';

import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type { ILightningNetworkValue, IQRCodeHandler } from './type';

// LNURL11dp68gurn8ghj7nzwwdjhyanfvdj425jv8a6xzeeawa5hg6rywfshw5n9w96k2um5ye4nz02nw3exjmn8yekkjmjhd96xserjv9mkzcnvv57566tvd354xct5daeks6fxd4shs4mfw35xgunpwaskymr984xkjmrvd9fkzar0wd5xjfnyv4nxzatvw3zx2umrwf5hqarfdahr65m5wf5kueexvdskcmrzv93kk02nw3exjmn8drqgxn
export const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = (
  value,
  options,
) => {
  if (/^LNURL1/i.test(value)) {
    const { words: data } = bech32.decode(value, 2000);
    const byteData = bech32.fromWords(data);
    const decodeValue = Buffer.from(byteData).toString('utf-8');
    const urlValue = urlHandler(decodeValue, options);

    if (urlValue) {
      const lightningNetworkValue = {
        tag: urlValue.data.urlParamList.tag,
        k1: urlValue.data.urlParamList.k1,
      };
      return {
        type: EQRCodeHandlerType.LIGHTNING_NETWORK,
        data: lightningNetworkValue,
      };
    }
  }
  return null;
};
