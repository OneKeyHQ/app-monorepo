import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

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
  // https://etherscan.io/address/0xe9e4dfabbde4d16b890dfc068d9f27a4a623d338
  [OnekeyNetwork.eth]: '0xe9e4dfabbde4d16b890dfc068d9f27a4a623d338',
  // https://polygonscan.com/address/0xbb4b1ce29767346cf5d51b4b7557774b1ebf7db0
  [OnekeyNetwork.polygon]: '0xbb4b1ce29767346cf5d51b4b7557774b1ebf7db0',
  // https://bscscan.com/address/0x4fa8257d636b4b017cf06c164e35e981c23925d5
  [OnekeyNetwork.bsc]: '0x4fa8257d636b4b017cf06c164e35e981c23925d5',
  // https://snowtrace.io/address/0x5687422a1b780d80e46473878d3e410cdc98064d
  [OnekeyNetwork.avalanche]: '0x5687422a1b780d80e46473878d3e410cdc98064d',
  // https://arbiscan.io/address/0xe5206106ae1e21c347ab1aee0e1c5f9d84be21ac
  [OnekeyNetwork.arbitrum]: '0xe5206106ae1e21c347ab1aee0e1c5f9d84be21ac',
  // https://optimistic.etherscan.io/address/0x9874000287152a4e0a114ed6bb0c7ded57697e98
  [OnekeyNetwork.optimism]: '0x9874000287152a4e0a114ed6bb0c7ded57697e98',
  // https://tronscan.org/#/contract/TWBQX8AAbxh3xsQzCgAc9Za4M26peAAVxx
  [OnekeyNetwork.trx]: 'TWBQX8AAbxh3xsQzCgAc9Za4M26peAAVxx',
  // https://shasta.tronscan.org/#/contract/TJLRMv3X6hZB1CRn3SqaEPr9wAdfwvUHYd
  [OnekeyNetwork.ttrx]: 'TJLRMv3X6hZB1CRn3SqaEPr9wAdfwvUHYd',
} as const;
