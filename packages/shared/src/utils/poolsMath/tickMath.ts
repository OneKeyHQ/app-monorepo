import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Port of Uniswap v3-core TickMath. Constants are built from strings and
// shifts: the React Native babel preset compiles `**` to Math.pow, which
// throws on BigInt operands.

export const MIN_TICK = -887_272;
export const MAX_TICK = 887_272;

export const MIN_SQRT_RATIO = BigInt('4295128739');
export const MAX_SQRT_RATIO = BigInt(
  '1461446703485210103287273052203988822378723970342',
);

const ONE = BigInt(1);
const SHIFT_128 = BigInt(128);
const Q32 = ONE << BigInt(32);
const MAX_UINT256 = (ONE << BigInt(256)) - ONE;

export const Q96 = ONE << BigInt(96);

// sqrt(1.0001)^-bit as Q128.128, one entry per bit of |tick| above the first
const RATIO_FACTORS: ReadonlyArray<readonly [number, bigint]> = [
  [0x2, BigInt('0xfff97272373d413259a46990580e213a')],
  [0x4, BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')],
  [0x8, BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')],
  [0x10, BigInt('0xffcb9843d60f6159c9db58835c926644')],
  [0x20, BigInt('0xff973b41fa98c081472e6896dfb254c0')],
  [0x40, BigInt('0xff2ea16466c96a3843ec78b326b52861')],
  [0x80, BigInt('0xfe5dee046a99a2a811c461f1969c3053')],
  [0x1_00, BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')],
  [0x2_00, BigInt('0xf987a7253ac413176f2b074cf7815e54')],
  [0x4_00, BigInt('0xf3392b0822b70005940c7a398e4b70f3')],
  [0x8_00, BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')],
  [0x10_00, BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')],
  [0x20_00, BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')],
  [0x40_00, BigInt('0x70d869a156d2a1b890bb3df62baf32f7')],
  [0x80_00, BigInt('0x31be135f97d08fd981231505542fcfa6')],
  [0x1_00_00, BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')],
  [0x2_00_00, BigInt('0x5d6af8dedb81196699c329225ee604')],
  [0x4_00_00, BigInt('0x2216e584f5fa1ea926041bedfe98')],
  [0x8_00_00, BigInt('0x48a170391f7dc42444e8fa2')],
];

/** sqrt(1.0001^tick) as a Q64.96, rounded up like the contract */
export function getSqrtRatioAtTick(tick: number): bigint {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) {
    throw new OneKeyLocalError(`Tick out of range: ${tick}`);
  }
  const absTick = Math.abs(tick);
  let ratio =
    (absTick & 0x1) !== 0
      ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
      : ONE << SHIFT_128;
  for (const [bit, factor] of RATIO_FACTORS) {
    if ((absTick & bit) !== 0) {
      ratio = (ratio * factor) >> SHIFT_128;
    }
  }
  if (tick > 0) {
    ratio = MAX_UINT256 / ratio;
  }
  return ratio % Q32 > BigInt(0) ? ratio / Q32 + ONE : ratio / Q32;
}

/**
 * Greatest tick whose sqrt ratio is <= the input; the same result as the
 * contract's log-based version, found by binary search instead.
 */
export function getTickAtSqrtRatio(sqrtRatioX96: bigint): number {
  if (sqrtRatioX96 < MIN_SQRT_RATIO || sqrtRatioX96 >= MAX_SQRT_RATIO) {
    throw new OneKeyLocalError('Sqrt ratio out of range');
  }
  let low = MIN_TICK;
  let high = MAX_TICK;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (getSqrtRatioAtTick(mid) <= sqrtRatioX96) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}
