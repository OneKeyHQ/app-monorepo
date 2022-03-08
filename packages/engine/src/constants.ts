const SEPERATOR = '--';

const IMPL_EVM = 'evm';
const COINTYPE_ETH = '60';

const IMPL_SOL = 'sol';
const COINTYPE_SOL = '501';

const IMPL_ALGO = 'algo';
const COINTYPE_ALGO = '283';

const IMPL_NEAR = 'near';
const COINTYPE_NEAR = '397';

const IMPL_STC = 'stc';
const COINTYPE_STC = '101010';

const IMPL_CFX = 'cfx';
const COINTYPE_CFX = '503';

const SUPPORTED_IMPLS = new Set([
  IMPL_EVM,
  IMPL_SOL,
  IMPL_ALGO,
  IMPL_NEAR,
  IMPL_STC,
  IMPL_CFX,
]);

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
  IMPL_STC,
  COINTYPE_STC,
  IMPL_CFX,
  COINTYPE_CFX,
  SUPPORTED_IMPLS,
};
