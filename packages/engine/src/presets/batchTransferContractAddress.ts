import { OnekeyNetwork } from './networkIds';

export const batchTransferContractAddress: {
  [k: string]: string;
} = {
  [OnekeyNetwork.eth]: '',
  [OnekeyNetwork.goerli]: '0x8cEF2eF3887eFfd2A18fE758A6Cf04C5fdc85ae6',
  [OnekeyNetwork.polygon]: '0x8dB8e4a1351E333823c016E931672dD10779e7F5',
} as const;
