// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'eth-... Remove this comment to see the full error message
import { parse as ethParser } from 'eth-url-parser';

import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';

import { EQRCodeHandlerType } from '../type';

import type { IEthereumValue, IQRCodeHandler } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
// ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@1?value=1e8

// eslint-disable-next-line spellcheck/spell-checker
// ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@1/transfer?address=0x178e3e6c9f547A00E33150F7104427ea02cfc747&uint256=1e8

// https://github.com/ethereum/ercs/blob/master/ERCS/erc-681.md
export const ethereum: IQRCodeHandler<IEthereumValue> = async (
  value,
  options,
) => {
  if (!/^ethereum:/i.test(value)) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const parseValue = ethParser(value);
  const {
    target_address: targetAddress,
    function_name: functionName,
    chain_id: chainId = '1',
    parameters: { address, uint256, value: amountValue } = {
      address: undefined,
      uint256: undefined,
      value: undefined,
    },
  } = parseValue;

  let nativeAmount: string | undefined;
  let sendAddress: string | undefined;
  if (functionName === 'transfer' && address) {
    nativeAmount = uint256;
    sendAddress = address;
  } else if (targetAddress) {
    nativeAmount = amountValue;
    sendAddress = targetAddress;
  }
  if (sendAddress) {
    const networkList =
      await options?.backgroundApi?.serviceNetwork?.getNetworksByImpls?.({
        impls: [IMPL_EVM],
      });
    const network = networkList?.networks?.find?.((n) => n.chainId === chainId);
    const ethereumValue: IEthereumValue = {
      address: sendAddress,
      id: chainId,
      network,
    };
    if (nativeAmount && network) {
      ethereumValue.amount = chainValueUtils.convertGweiToAmount({
        value: nativeAmount,
        network,
      });
    }
    return { type: EQRCodeHandlerType.ETHEREUM, data: ethereumValue };
  }
  return null;
};
