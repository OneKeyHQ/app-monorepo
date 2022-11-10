import { OnekeyNetwork } from './networkIds';

export const batchTransferContractAddress: {
  [k: string]: string;
} = {
  [OnekeyNetwork.eth]: '',
  [OnekeyNetwork.goerli]: '0x5c7f4ebc4eee3f31aec2a28faeac68b3c2fd4d55',
} as const;
