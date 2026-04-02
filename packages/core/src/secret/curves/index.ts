import { ed25519, nistp256, secp256k1 } from './elliptic';

import type { IBaseCurve, ICurveForKD } from './base';

export type { IBaseCurve as BaseCurve, ICurveForKD as CurveForKD };
export { secp256k1, nistp256, ed25519 };
