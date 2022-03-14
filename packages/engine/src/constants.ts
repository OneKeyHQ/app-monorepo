const SEPERATOR = '--';

const IMPL_EVM = 'evm';
const COINTYPE_ETH = '60';

const IMPL_SOL = 'sol';
const COINTYPE_SOL = '501';

const IMPL_ALGO = 'algo';
const COINTYPE_ALGO = '283';

const IMPL_NEAR = 'near';
const COINTYPE_NEAR = '397';

const SUPPORTED_IMPLS = new Set([IMPL_EVM, IMPL_SOL, IMPL_ALGO, IMPL_NEAR]);

export {
  SEPERATOR,
  IMPL_EVM,
  COINTYPE_ETH,
  IMPL_SOL,
  COINTYPE_SOL,
  IMPL_ALGO,
  COINTYPE_ALGO,
  IMPL_NEAR,
  COINTYPE_NEAR,
  SUPPORTED_IMPLS,
};
