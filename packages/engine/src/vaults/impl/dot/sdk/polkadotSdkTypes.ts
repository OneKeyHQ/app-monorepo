import type { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import type {
  bufferToU8a,
  hexToNumber,
  hexToU8a,
  u8aConcat,
  u8aToHex,
  u8aToU8a,
  u8aWrapBytes,
} from '@polkadot/util';
import type {
  decodeAddress,
  encodeAddress,
  hdLedger,
} from '@polkadot/util-crypto';

export type { ProviderInterface } from '@polkadot/rpc-provider/types';
export type { Metadata } from '@polkadot/types';
export type { BlockHash, RuntimeVersion } from '@polkadot/types/interfaces';
export type { InjectedAccount } from '@polkadot/extension-inject/types';
export type {
  SignerPayloadJSON,
  SignerPayloadRaw,
} from '@polkadot/types/types';
export { EXTRINSIC_VERSION } from '@polkadot/types/extrinsic/v4/Extrinsic';

export type IApiPromise = ApiPromise;
export type IHttpProvider = HttpProvider;
export type IWsProvider = WsProvider;

export interface IPolkadotSdk {
  ApiPromise: typeof ApiPromise;
  HttpProvider: typeof HttpProvider;
  WsProvider: typeof WsProvider;
  bufferToU8a: typeof bufferToU8a;
  u8aWrapBytes: typeof u8aWrapBytes;
  u8aConcat: typeof u8aConcat;
  hdLedger: typeof hdLedger;
  hexToNumber: typeof hexToNumber;
  hexToU8a: typeof hexToU8a;
  u8aToHex: typeof u8aToHex;
  u8aToU8a: typeof u8aToU8a;
  decodeAddress: typeof decodeAddress;
  encodeAddress: typeof encodeAddress;
}
