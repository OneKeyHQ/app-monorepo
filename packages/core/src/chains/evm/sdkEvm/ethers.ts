import { providers } from 'ethers';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from 'ethers';

export const EthersJsonRpcProvider = providers.JsonRpcProvider;
export const EthersJsonRpcBatchProvider = providers.JsonRpcBatchProvider;
