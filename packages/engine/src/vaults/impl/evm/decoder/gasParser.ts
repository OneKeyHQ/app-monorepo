import { ethers } from '../sdk/ethers';

import type { Transaction } from '../../../../types/covalent';
import type { EVMDecodedItem, GasInfo } from './types';

const parseFeeSpend = (covalentTx: Transaction) => {
  const { gasPrice, gasSpent } = covalentTx;
  const gasPriceBn = ethers.BigNumber.from(gasPrice);
  const feeSpendInWei = gasPriceBn.mul(gasSpent);
  return ethers.utils.formatEther(feeSpendInWei);
};

const parseMaxFeeSpend = (tx: ethers.Transaction): string => {
  const { gasLimit, gasPrice, maxFeePerGas } = tx;
  const priceInWei = gasPrice || maxFeePerGas || ethers.constants.Zero;
  const gasSpendInWei = gasLimit.mul(priceInWei);
  return ethers.utils.formatEther(gasSpendInWei);
};

const parseEffectiveGasPrice = (
  tx?: ethers.Transaction | null,
  covalentTx?: Transaction | null,
) => {
  if (covalentTx) {
    return covalentTx.gasPrice.toString();
  }
  return tx?.gasPrice?.toString() ?? '0';
};

const updateGasInfo = (tx: EVMDecodedItem, covalentTx: Transaction) => {
  const { gasSpent, gasOffered } = covalentTx;
  const feeSpend = parseFeeSpend(covalentTx);
  const gasUsed = gasSpent;
  const gasUsedRatio = gasSpent / gasOffered;
  const gasInfo = { ...tx.gasInfo, feeSpend, gasUsed, gasUsedRatio };
  tx.gasInfo = gasInfo;
  return tx;
};

const parseGasInfo = (
  tx?: ethers.Transaction | null,
  covalentTx?: Transaction | null,
): GasInfo => {
  if (!tx && !covalentTx) {
    throw new Error(`tx or covalentTx at least one is required.`);
  }

  const effectiveGasPrice = parseEffectiveGasPrice(tx, covalentTx);
  const effectiveGasPriceInGwei = ethers.utils.formatUnits(
    effectiveGasPrice,
    'gwei',
  );

  let feeSpend = '';
  let gasUsed = 0;
  let gasUsedRatio = 0;
  if (covalentTx) {
    const { gasSpent, gasOffered } = covalentTx;
    feeSpend = parseFeeSpend(covalentTx);
    gasUsed = gasSpent;
    gasUsedRatio = gasSpent / gasOffered;
  }

  if (!tx) {
    return {
      gasLimit: covalentTx?.gasOffered ?? 0,
      gasPrice: covalentTx?.gasPrice.toString() ?? '',
      maxPriorityFeePerGas: '',
      maxFeePerGas: '',
      maxFeeSpend: feeSpend,
      feeSpend,
      gasUsed,
      gasUsedRatio,
      maxFeePerGasInGwei: '',
      maxPriorityFeePerGasInGwei: '',
      effectiveGasPrice,
      effectiveGasPriceInGwei,
    };
  }

  const { gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas } = tx;
  const maxFeeSpend = parseMaxFeeSpend(tx);

  const maxFeePerGasInGwei = maxFeePerGas
    ? ethers.utils.formatUnits(maxFeePerGas, 'gwei')
    : '';
  const maxPriorityFeePerGasInGwei = maxPriorityFeePerGas
    ? ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')
    : '';

  return {
    gasLimit: gasLimit.toNumber(),
    gasPrice: gasPrice?.toString() ?? '',
    maxPriorityFeePerGas: maxPriorityFeePerGas?.toString() ?? '',
    maxFeePerGas: maxFeePerGas?.toString() ?? '',
    maxFeeSpend,
    feeSpend,
    gasUsed,
    gasUsedRatio,
    maxFeePerGasInGwei,
    maxPriorityFeePerGasInGwei,
    effectiveGasPrice,
    effectiveGasPriceInGwei,
  };
};

export { parseGasInfo, updateGasInfo };
