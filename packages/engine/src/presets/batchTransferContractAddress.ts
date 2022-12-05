import { OnekeyNetwork } from './networkIds';

/*
Check Contract Miniity SourceCode:
 packages/engine/src/vaults/impl/evm/decoder/batchTransferContract/Disperse.sol

Compiler Version
v0.8.17+commit.8df45f5f

Contract Creation Code
6080...0033

Swarm Source
ipfs://0c42f631543ed0b0dfde4783e36b5900bffae1728a7dc8de3d44f7d1fd388e33
 */

export const batchTransferContractAddress: {
  [k: string]: string;
} = {
  // https://etherscan.io/address/0x94214d492f1c94c977378e0884e1dc3f32ee6b99
  [OnekeyNetwork.eth]: '0x94214d492f1c94c977378e0884e1dc3f32ee6b99',
  // https://goerli.etherscan.io/address/0x6bbe9c913e6ae7448b8cc975bac5364a557c724a
  [OnekeyNetwork.goerli]: '0x6bbe9c913e6ae7448b8cc975bac5364a557c724a',
  // https://polygonscan.com/address/0x8db8e4a1351e333823c016e931672dd10779e7f5
  [OnekeyNetwork.polygon]: '0x8db8e4a1351e333823c016e931672dd10779e7f5',
  // https://bscscan.com/address/0xbeaa4219f495611ccccc441c1f19ab0b3708dc67
  [OnekeyNetwork.bsc]: '0xbeaa4219f495611ccccc441c1f19ab0b3708dc67',
  // https://snowtrace.io/address/0xe786ad03a6a35da315436a7e30be731047972091
  [OnekeyNetwork.avalanche]: '0xe786ad03a6a35da315436a7e30be731047972091',
  // https://arbiscan.io/address/0x9801d11c0ed5bdadcc30b37bd1a99e3d06022503
  [OnekeyNetwork.arbitrum]: '0x9801d11c0ed5bdadcc30b37bd1a99e3d06022503',
  // https://optimistic.etherscan.io/address/0x8e17ed9f91ddab1f2d7c2075abf7c293d3a28cd3
  [OnekeyNetwork.optimism]: '0x8e17ed9f91ddab1f2d7c2075abf7c293d3a28cd3',
} as const;
