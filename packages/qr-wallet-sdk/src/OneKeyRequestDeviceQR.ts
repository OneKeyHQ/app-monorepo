import { AirGapUR } from './AirGapUR';

import type { IAirGapUrJson } from './AirGapUR';

export type IOneKeyRequestDeviceQRData = {
  requestId: string;
  xfp: string;
  deviceId?: string;
  origin: string;
  method: string;
  params: any;
};
export class OneKeyRequestDeviceQR {
  constructor(props: IOneKeyRequestDeviceQRData) {
    this.data = props;
  }

  data: IOneKeyRequestDeviceQRData;

  type = 'onekey-app-call-device';

  toUR(): AirGapUR {
    const cbor = Buffer.from(JSON.stringify(this.data), 'utf-8');
    return new AirGapUR(cbor, this.type);
  }

  static fromCBOR(cbor: Buffer | Uint8Array): OneKeyRequestDeviceQR {
    const data = JSON.parse(Buffer.from(cbor).toString('utf-8'));
    return new OneKeyRequestDeviceQR(data);
  }

  static fromUR(ur: IAirGapUrJson | AirGapUR): OneKeyRequestDeviceQR {
    const cbor = ur instanceof AirGapUR ? ur.cbor : Buffer.from(ur.cbor, 'hex');
    return OneKeyRequestDeviceQR.fromCBOR(cbor);
  }
}
