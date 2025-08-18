/* eslint-disable no-restricted-syntax */
import { URType } from '@keystonehq/keystone-sdk';
import {
  toBuffer,
  toHex,
  uuidParse,
  uuidStringify,
} from '@keystonehq/keystone-sdk/dist/utils';

import { SignType, TronSignRequest, TronSignature } from './tronSDK';

import type { IAirGapSDK } from '../types';
import type { UR } from '@keystonehq/keystone-sdk';

type IAirGapTronSignRequestProps = {
  requestId: string;
  signData: string;
  dataType: SignType;
  path: string;
  xfp: string;
  address?: string;
  origin?: string;
};

export class AirGapTronSDK implements IAirGapSDK {
  normalizeGetMultiAccountsPath(path: string) {
    return path;
  }

  static DataType = SignType;

  parseSignature(ur: UR): {
    requestId?: string;
    signature: string;
    raw: string;
  } {
    if (ur.type !== URType.TronSignature) {
      throw new Error('type not match');
    }
    const sig = TronSignature.fromCBOR(ur.cbor);
    const requestId = sig.getRequestId();
    return {
      requestId: requestId === undefined ? undefined : uuidStringify(requestId),
      signature: toHex(sig.getSignature()),
      raw: '',
    };
  }

  generateSignRequest({
    requestId,
    signData,
    dataType,
    path,
    xfp,
    address,
    origin,
  }: IAirGapTronSignRequestProps): UR {
    return new TronSignRequest({
      requestId: uuidParse(requestId),
      signData: toBuffer(signData),
      signType: dataType,
      derivationPath: TronSignRequest.parsePath(path, xfp),
      address: address !== undefined ? toBuffer(address) : undefined,
      origin,
    }).toUR();
  }
}
