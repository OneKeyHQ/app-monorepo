// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'eth-... Remove this comment to see the full error message
import { parse as ethParser } from 'eth-url-parser';

import { EQRCodeHandlerType } from '../type';

// import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';

import type { IEthereumValue, IQRCodeHandler } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
// ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@1?value=1e8

// eslint-disable-next-line spellcheck/spell-checker
// ethereum:0x3dD3DfaAdA4d6765Ae19b8964E2BAC0139eeCb40@1/transfer?address=0x178e3e6c9f547A00E33150F7104427ea02cfc747&uint256=1e8

// https://github.com/ethereum/ercs/blob/master/ERCS/erc-681.md
export const ethereum: IQRCodeHandler<IEthereumValue> = (value) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const parseValue = ethParser(value);
  const {
    target_address: targetAddress,
    function_name: functionName,
    chain_id: chainId = 1,
    // value: unitValue,
    parameters: {
      address,
      // uint256
    } = { address: null },
  } = parseValue;

  let ethereumValue: IEthereumValue | undefined;
  if (functionName === 'transfer' && address) {
    ethereumValue = {
      address,
      id: Number(chainId),
      // amount: uint256
      //   ? chainValueUtils.convertGweiToAmount({
      //       value: uint256,
      //       network: {
      //         decimals: 18,
      //       },
      //     })
      //   : null,
    };
  } else if (targetAddress) {
    ethereumValue = {
      address: targetAddress,
      id: Number(chainId),
      // amount: unitValue
      //   ? chainValueUtils.convertGweiToAmount({
      //       value: unitValue,
      //       network: {
      //         decimals: 8,
      //       },
      //     })
      //   : null,
    };
  }
  if (ethereumValue) {
    return { type: EQRCodeHandlerType.ETHEREUM, data: ethereumValue };
  }
  return null;
};
