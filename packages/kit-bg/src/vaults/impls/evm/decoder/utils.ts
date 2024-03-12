import { isNil, isString } from 'lodash';

import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';

export const InfiniteAmountText = 'Infinite';
export const InfiniteAmountHex =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export function checkIsEvmNativeTransfer({ tx }: { tx: ethers.Transaction }) {
  const { data } = tx;
  return !data || data === '0x' || data === '0x0' || data === '0';
}

function toBigNumberField(
  value?: string,
  defaultValue?: string,
): ethers.BigNumber {
  try {
    if (value === '0x' || value === '' || isNil(value)) {
      if (defaultValue === undefined) {
        // @ts-ignore
        return undefined;
      }
      return ethers.BigNumber.from(defaultValue);
    }
    return ethers.BigNumber.from(value);
  } catch (error) {
    return ethers.BigNumber.from('0');
  }
}

export function parseToNativeTx({
  encodedTx,
}: {
  encodedTx: string | IEncodedTxEvm;
}) {
  let ethersTx: ethers.Transaction;
  if (isString(encodedTx)) {
    ethersTx = ethers.utils.parseTransaction(encodedTx);
    ethersTx = {
      ...ethersTx,
      from: ethersTx.from?.toLowerCase(),
      to: ethersTx.to?.toLowerCase(),
    };
  } else {
    // @ts-ignore
    ethersTx = {
      ...encodedTx,
      gasLimit: toBigNumberField(encodedTx.gasLimit ?? encodedTx.gas, '0'),
      gasPrice: toBigNumberField(encodedTx.gasPrice),
      value: toBigNumberField(encodedTx.value, '0'),
      maxPriorityFeePerGas: toBigNumberField(encodedTx.maxPriorityFeePerGas),
      maxFeePerGas: toBigNumberField(encodedTx.maxFeePerGas),
    };
    // @ts-ignore
    delete ethersTx?.gas;
  }

  return Promise.resolve(ethersTx);
}

export function formatValue(
  value: ethers.BigNumberish,
  decimals: number,
): string {
  const valueBn = ethers.BigNumber.from(value);
  if (ethers.constants.MaxUint256.eq(valueBn)) {
    return InfiniteAmountText;
  }
  return ethers.utils.formatUnits(valueBn, decimals) ?? '0';
}
