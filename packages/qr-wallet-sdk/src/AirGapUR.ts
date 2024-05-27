export {
  UR as AirGapUR,
  UREncoder as AirGapUREncoder,
  URDecoder as AirGapURDecoder,
} from '@ngraveio/bc-ur';

export type IAirGapUrJson = { type: string; cbor: string };
