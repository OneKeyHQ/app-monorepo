import { OnekeyNetwork } from './networkIds';

export const batchTransferContractAddress: {
  [k: string]: string;
} = {
  [OnekeyNetwork.eth]: '',
  [OnekeyNetwork.goerli]: '0x8cef2ef3887effd2a18fe758a6cf04c5fdc85ae6',
  [OnekeyNetwork.polygon]: '0x8db8e4a1351e333823c016e931672dd10779e7f5',
} as const;
