import { OnekeyNetwork } from './networkIds';

export const batchTransferContractAddress: {
  [k: string]: string;
} = {
  [OnekeyNetwork.eth]: '',
  [OnekeyNetwork.goerli]: '0x6bbe9c913e6ae7448b8cc975bac5364a557c724a',
  [OnekeyNetwork.polygon]: '0x8db8e4a1351e333823c016e931672dd10779e7f5',
  [OnekeyNetwork.bsc]: '0xbeaa4219f495611ccccc441c1f19ab0b3708dc67',
  [OnekeyNetwork.avalanche]: '0xe786ad03a6a35da315436a7e30be731047972091',
  [OnekeyNetwork.arbitrum]: '0x9801d11c0ed5bdadcc30b37bd1a99e3d06022503',
  [OnekeyNetwork.optimism]: '0x8e17ed9f91ddab1f2d7c2075abf7c293d3a28cd3',
} as const;
