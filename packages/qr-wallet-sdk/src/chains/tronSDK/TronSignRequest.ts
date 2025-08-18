/* eslint-disable radix */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  CryptoKeypath,
  DataItem,
  PathComponent,
  RegistryItem,
  extend,
} from '@keystonehq/bc-ur-registry';
import { parse as uuidParse } from 'uuid';

import { ExtendedRegistryTypes } from './RegistryType';

import type { DataItemMap } from '@keystonehq/bc-ur-registry';

const { decodeToDataItem, RegistryTypes } = extend;

export enum SignType {
  Transaction = 0,
  SignMessage = 1,
  SignMessageV2 = 2,
}

enum Keys {
  requestId = 1,
  signData,
  signType,
  derivationPath,
  address,
  origin,
}

type SignRequestProps = {
  requestId?: Buffer;
  signData: Buffer;
  signType: SignType;
  derivationPath: CryptoKeypath;
  address?: Buffer;
  origin?: string;
};

export class TronSignRequest extends RegistryItem {
  private requestId?: Buffer;

  private signData: Buffer;

  private dataType: SignType;

  private derivationPath: CryptoKeypath;

  private address?: Buffer;

  private origin?: string;

  getRegistryType = () => ExtendedRegistryTypes.TRON_SIGN_REQUEST;

  constructor(args: SignRequestProps) {
    super();
    this.requestId = args.requestId;
    this.signData = args.signData;
    this.dataType = args.signType;
    this.derivationPath = args.derivationPath;
    this.address = args.address;
    this.origin = args.origin;
  }

  public getRequestId = () => this.requestId;

  public getSignData = () => this.signData;

  public getDerivationPath = () => this.derivationPath.getPath();

  public getAddress = () => this.address;

  public getOrigin = () => this.origin;

  public toDataItem = () => {
    const map: DataItemMap = {};
    map[Keys.signData] = this.signData;
    map[Keys.signType] = this.dataType;

    const derivationPath = this.derivationPath.toDataItem();
    derivationPath.setTag(this.derivationPath.getRegistryType().getTag());
    map[Keys.derivationPath] = derivationPath;

    if (this.requestId) {
      map[Keys.requestId] = new DataItem(
        this.requestId,
        RegistryTypes.UUID.getTag(),
      );
    }

    if (this.address) {
      map[Keys.address] = this.address;
    }

    if (this.origin) {
      map[Keys.origin] = this.origin;
    }

    return new DataItem(map);
  };

  public static fromDataItem = (dataItem: DataItem) => {
    const map = dataItem.getData();

    const requestId = map[Keys.requestId]
      ? (map[Keys.requestId] as DataItem).getData()
      : undefined;

    return new TronSignRequest({
      requestId,
      signData: map[Keys.signData],
      derivationPath: CryptoKeypath.fromDataItem(map[Keys.derivationPath]),
      address: map[Keys.address],
      origin: map[Keys.origin],
      signType: map[Keys.signType],
    });
  };

  public static fromCBOR = (_cborPayload: Buffer) => {
    const dataItem = decodeToDataItem(_cborPayload);
    return TronSignRequest.fromDataItem(dataItem);
  };

  public static parsePath(path: string, xfp: string) {
    const paths = path.replace(/[m|M]\//, '').split('/');
    const pathComponent = paths.map((p) => {
      const index = parseInt(p.replace("'", ''));
      let isHardened = false;
      if (p.endsWith("'")) {
        isHardened = true;
      }
      return new PathComponent({ index, hardened: isHardened });
    });
    return new CryptoKeypath(pathComponent, Buffer.from(xfp, 'hex'));
  }

  public static constructTronRequest(
    signData: Buffer,
    derivationHDPath: string,
    xfp: string,
    signType: SignType,
    uuidString?: string,
    address?: Buffer,
    origin?: string,
  ) {
    return new TronSignRequest({
      requestId: uuidString
        ? Buffer.from(uuidParse(uuidString) as Uint8Array)
        : undefined,
      signData,
      signType,
      derivationPath: TronSignRequest.parsePath(derivationHDPath, xfp),
      address,
      origin,
    });
  }
}
