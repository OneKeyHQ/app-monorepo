import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';

import { ABI } from './abi';

class EVMContractDecoder {
  private erc20Interface: ethers.utils.Interface;

  private erc721Interface: ethers.utils.Interface;

  private erc1155Interface: ethers.utils.Interface;

  private batchTransferInterface: ethers.utils.Interface;

  constructor() {
    this.erc20Interface = new ethers.utils.Interface(ABI.ERC20);
    this.erc721Interface = new ethers.utils.Interface(ABI.ERC721);
    this.erc1155Interface = new ethers.utils.Interface(ABI.ERC1155);
    this.batchTransferInterface = new ethers.utils.Interface(
      ABI.BATCH_TRANSFER,
    );
  }

  public parseERC20(
    tx: ethers.Transaction,
  ): ethers.utils.TransactionDescription | null {
    try {
      return this.erc20Interface.parseTransaction(tx);
    } catch (error) {
      return null;
    }
  }

  public parseERC721(
    tx: ethers.Transaction,
  ): ethers.utils.TransactionDescription | null {
    try {
      return this.erc721Interface.parseTransaction(tx);
    } catch (error) {
      return null;
    }
  }

  public parseERC1155(
    tx: ethers.Transaction,
  ): ethers.utils.TransactionDescription | null {
    try {
      return this.erc1155Interface.parseTransaction(tx);
    } catch (error) {
      return null;
    }
  }

  public parseBatchTransfer(
    tx: ethers.Transaction,
  ): ethers.utils.TransactionDescription | null {
    try {
      return this.batchTransferInterface.parseTransaction(tx);
    } catch (error) {
      return null;
    }
  }
}

export { EVMContractDecoder };
