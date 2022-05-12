import { ethers } from '@onekeyfe/blockchain-libs';

import { Network } from '../../../../types/network';

import { parseGasInfo } from './gasParser';
import { EVMDecodedItem, EVMDecodedTxType } from './types';

import type { Transaction } from '../../../../types/covalent';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseCovalentType = (covalentTx: Transaction) =>
  // TODO: parseType
  EVMDecodedTxType.TRANSACTION;

const parseCovalent = (covalentTx: Transaction, network: Network) => {
  const itemBuilder = {} as EVMDecodedItem;
  itemBuilder.txType = parseCovalentType(covalentTx);
  itemBuilder.mainSource = 'covalent';

  itemBuilder.symbol = network.symbol;
  itemBuilder.value = covalentTx.value;
  itemBuilder.amount = ethers.utils.formatEther(covalentTx.value);
  itemBuilder.network = network;

  itemBuilder.fromAddress = covalentTx.fromAddress;
  itemBuilder.toAddress = covalentTx.toAddress;
  itemBuilder.txHash = covalentTx.txHash;
  itemBuilder.chainId = network.extraInfo.chainId;
  itemBuilder.fromType = 'IN';
  itemBuilder.gasInfo = parseGasInfo(null, covalentTx);
  itemBuilder.total = ethers.utils.formatEther(
    ethers.utils
      .parseEther(itemBuilder.value)
      .add(
        ethers.utils.parseEther(
          itemBuilder.gasInfo.feeSpend || itemBuilder.gasInfo.maxFeeSpend,
        ),
      ),
  );

  itemBuilder.info = null;
  return itemBuilder;
};

export { parseCovalent, parseGasInfo };
