import { Interface } from '@ethersproject/abi';
// @ts-expect-error no typings for this package yet
import abi from 'human-standard-token-abi';

import ProviderApiBase from '@onekeyhq/kit/src/background/providers/ProviderApiBase';

const hstInterface = new Interface(abi);

export enum TtransactionTypes {
  TOKEN_METHOD_TRANSFER = 'transfer',
  TOKEN_METHOD_APPROVE = 'approve',
  CONTRACT_INTERACTION = 'contractInteraction',
  DEPLOY_CONTRACT = 'contractDeployment',
  SWAP = 'swap',
  SWAP_APPROVAL = 'swapApproval',
  SIMPLE_SEND = 'simpleSend',
}

type ReadAddressAsContractReturn = {
  isContractAddress: boolean;
  contractCode?: string | null;
};
export async function readAddressAsContract(
  provider: ProviderApiBase,
  address: string,
): Promise<ReadAddressAsContractReturn> {
  let contractCode;
  try {
    contractCode = await provider.rpcCall({
      method: 'eth_getCode',
      params: [address, 'latest'],
    });
  } catch (e) {
    contractCode = null;
  }

  const isContractAddress =
    contractCode && contractCode !== '0x' && contractCode !== '0x0';
  return { contractCode, isContractAddress };
}

export async function determineTransactionType(
  txParams: { data?: string; to?: string },
  provider: ProviderApiBase,
) {
  const { data, to } = txParams;
  let name: string | undefined;
  try {
    name = data && hstInterface.parseTransaction({ data }).name;
  } catch (error) {
    console.error('Failed to parse transaction data.', error, data);
  }

  const tokenMethodName = [
    TtransactionTypes.TOKEN_METHOD_APPROVE,
    TtransactionTypes.TOKEN_METHOD_TRANSFER,
  ].find((methodName) => methodName.toLowerCase() === name?.toLowerCase());

  let result;
  if (data && tokenMethodName) {
    result = tokenMethodName;
  } else if (data && !to) {
    result = TtransactionTypes.DEPLOY_CONTRACT;
  }

  let contractCode;

  if (!result && to) {
    const { contractCode: resultCode, isContractAddress } =
      await readAddressAsContract(provider, to);

    contractCode = resultCode;
    result = isContractAddress
      ? TtransactionTypes.CONTRACT_INTERACTION
      : TtransactionTypes.SIMPLE_SEND;
  }

  return { type: result, contractCode };
}
