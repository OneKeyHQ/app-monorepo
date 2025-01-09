import { cloneDeep, isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import type {
  ISignMessageParams,
  ISignTransactionParams,
} from '../../../vaults/types';

function parseSendTransactionParams({
  params,
}: {
  params: ISignTransactionParams;
}) {
  const { signOnly } = params;
  if (signOnly) {
    throw new Error(
      'KeyringExternal signTransaction ERROR: signOnly not supported for WalletConnect.',
    );
  }

  const method: 'eth_signTransaction' | 'eth_sendTransaction' = signOnly
    ? 'eth_signTransaction'
    : 'eth_sendTransaction';
  const tx = cloneDeep(params.unsignedTx.encodedTx as IEncodedTxEvm);
  // TODO remove number nonce cause Metamask throw error: 'e.startsWith is not a function'
  if (!isNil(tx.nonce)) {
    tx.nonce = numberUtils.numberToHex(tx.nonce);
  }
  const callParams = [tx];

  return {
    method,
    callParams,
  };
}

function parseSignMessageParams({ params }: { params: ISignMessageParams }) {
  const firstMessageInfo = params.messages[0];

  let method:
    | 'personal_sign'
    | 'eth_sign'
    | 'eth_signTypedData'
    | 'eth_signTypedData_v3'
    | 'eth_signTypedData_v4'
    | undefined;
  if (firstMessageInfo.type === EMessageTypesEth.PERSONAL_SIGN) {
    method = 'personal_sign';
  } else if (firstMessageInfo.type === EMessageTypesEth.ETH_SIGN) {
    method = 'eth_sign';
  } else if (firstMessageInfo.type === EMessageTypesEth.TYPED_DATA_V1) {
    method = 'eth_signTypedData';
  } else if (firstMessageInfo.type === EMessageTypesEth.TYPED_DATA_V3) {
    method = 'eth_signTypedData_v3';
  } else if (firstMessageInfo.type === EMessageTypesEth.TYPED_DATA_V4) {
    method = 'eth_signTypedData_v4';
  }

  const callParams = firstMessageInfo?.payload || [];

  if (!method) {
    throw new Error(
      `KeyringExternal signMessage ERROR: method not support, ${firstMessageInfo.type}`,
    );
  }
  return {
    method,
    callParams,
  };
}

export default {
  parseSendTransactionParams,
  parseSignMessageParams,
};
