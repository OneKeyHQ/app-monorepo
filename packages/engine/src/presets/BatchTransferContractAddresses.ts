import { OnekeyNetwork } from './networkIds';

export const BatchTransferContractAddresses: {
  [k: string]: string;
} = {
  [OnekeyNetwork.eth]: '',
  [OnekeyNetwork.goerli]: '0x5c7f4Ebc4EeE3f31Aec2A28FAEaC68B3c2FD4D55',
} as const;
