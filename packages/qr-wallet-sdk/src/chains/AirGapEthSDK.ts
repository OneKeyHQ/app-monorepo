import {
  findHDPathFromAddress,
  generateAddressFromXpub,
} from '@keystonehq/bc-ur-registry-eth';
import { KeystoneEthereumSDK } from '@keystonehq/keystone-sdk';

export class AirGapEthSDK extends KeystoneEthereumSDK {
  generateAddressFromXpub(params: { xpub: string; derivePath: string }) {
    // derivePath: `m/0/0`, `m/0/1` `m/0/2`
    return generateAddressFromXpub(params.xpub, params.derivePath);
  }

  findHDPathFromAddress(params: {
    address: string;
    xpub: string;
    numberLimit: number;
    rootPath: string;
  }) {
    return findHDPathFromAddress(
      params.address,
      params.xpub,
      params.numberLimit,
      params.rootPath,
    );
  }




}
