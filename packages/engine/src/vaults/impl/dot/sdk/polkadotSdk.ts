import { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import {
  bufferToU8a,
  hexToNumber,
  hexToU8a,
  u8aConcat,
  u8aToHex,
  u8aToU8a,
  u8aWrapBytes,
} from '@polkadot/util';
import { decodeAddress, encodeAddress, hdLedger } from '@polkadot/util-crypto';

import type { IPolkadotSdk } from './polkadotSdkTypes';

const sdk: IPolkadotSdk = {
  ApiPromise,
  HttpProvider,
  WsProvider,
  bufferToU8a,
  u8aWrapBytes,
  u8aConcat,
  hdLedger,
  hexToNumber,
  hexToU8a,
  u8aToHex,
  u8aToU8a,
  decodeAddress,
  encodeAddress,
};

export default sdk;
