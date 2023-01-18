import AddressEncodings from '@onekeyhq/blockchain-libs/src/provider/chains/btc/sdk/addressEncodings';

import { NotImplemented } from '../../../errors';

type IAccountDefault = {
  namePrefix: string;
  addressEncoding: AddressEncodings;
};

export function getAccountDefaultByPurpose(purpose: number): IAccountDefault {
  switch (purpose) {
    case 44:
      return {
        namePrefix: 'BTC Legacy',
        addressEncoding: AddressEncodings.P2PKH,
      };
    case 49:
      return {
        namePrefix: 'BTC Nested SegWit',
        addressEncoding: AddressEncodings.P2SH_P2WPKH,
      };
    case 84:
      return {
        namePrefix: 'BTC Native SegWit',
        addressEncoding: AddressEncodings.P2WPKH,
      };
    default:
      throw new NotImplemented(`Unsupported purpose ${purpose}.`);
  }
}
