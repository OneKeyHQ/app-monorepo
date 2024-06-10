import { decodeToDataItem } from '@keystonehq/bc-ur-registry';
import { isString } from 'lodash';

import { AirGapUR, AirGapURDecoder, AirGapUREncoder } from './AirGapUR';

import type { IAirGapUrJson } from './AirGapUR';

function decodeUrToDataItem(cbor: string) {
  const cborBuffer = Buffer.from(cbor, 'hex');
  return decodeToDataItem(cborBuffer);
}

function urToJson({ ur }: { ur: AirGapUR }): IAirGapUrJson {
  const cbor = ur.cbor.toString('hex');
  const type = ur.type;
  return {
    type,
    cbor,
  };
}

function jsonToUr({ ur }: { ur: IAirGapUrJson | AirGapUR }): AirGapUR {
  if (ur instanceof AirGapUR) {
    return ur;
  }
  return new AirGapUR(Buffer.from(ur.cbor, 'hex'), ur.type);
}

// EQRCodeHandlerType.ANIMATION_CODE
function createAnimatedURDecoder() {
  const decoder = new AirGapURDecoder();
  let receivePart: ((data: string) => void) | undefined;
  let abort = () => undefined;
  const promiseResultUR = new Promise<AirGapUR>((resolve, reject) => {
    abort = () => {
      reject(new Error('AnimatedURDecode aborted'));
    };
    receivePart = (data: string) => {
      decoder.receivePart(data);
      if (decoder.isComplete()) {
        resolve(decoder.resultUR());
      }
    };
  });

  return {
    decoder,
    receivePart,
    abort,
    promiseResultUR,
  };
}

function createAnimatedUREncoder({
  ur,
  maxFragmentLength,
  firstSeqNum,
  minFragmentLength,
}: {
  ur: AirGapUR | IAirGapUrJson;
  maxFragmentLength?: number;
  firstSeqNum?: number;
  minFragmentLength?: number;
}) {
  // eslint-disable-next-line no-param-reassign
  ur = jsonToUr({ ur });
  const encoder = new AirGapUREncoder(
    ur,
    maxFragmentLength,
    firstSeqNum,
    minFragmentLength,
  );
  const nextPart = encoder.nextPart.bind(encoder); // animatedQrPart
  const encodeWhole = encoder.encodeWhole.bind(encoder); // animatedQr all parts
  return {
    encoder,
    encodeWhole,
    nextPart,
  };
}

function qrcodeToUr(qrcode: string | string[]): Promise<AirGapUR> {
  const decoder = createAnimatedURDecoder();
  const empty: string[] = [];
  if (isString(qrcode)) {
    // eslint-disable-next-line no-param-reassign
    qrcode = qrcode
      .trim()
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const arr: string[] = empty.concat(qrcode);
  for (const part of arr) {
    const d = part.trim();
    if (d) {
      decoder?.receivePart?.(d);
    }
  }
  return decoder.promiseResultUR;
}

function urToQrcode(ur: AirGapUR | IAirGapUrJson) {
  // eslint-disable-next-line no-param-reassign
  ur = jsonToUr({ ur });
  const encoder = createAnimatedUREncoder({
    ur,
    maxFragmentLength: 100,
    firstSeqNum: 0,
  });
  const allParts = encoder.encodeWhole();
  const single = AirGapUREncoder.encodeSinglePart(ur);
  return {
    allParts,
    single,
  };
}

export default {
  decodeUrToDataItem,
  createAnimatedURDecoder,
  createAnimatedUREncoder,
  urToJson,
  jsonToUr,
  qrcodeToUr,
  urToQrcode,
};
