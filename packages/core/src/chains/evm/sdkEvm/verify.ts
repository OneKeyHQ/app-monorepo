import { ethers } from './ethers';

export type IVerifyEvmSignedTxMatchedParams = {
  signerAddress: string;
  rawTx: string; // signedRawTx
  txid: string;
  signature: {
    v: string | number;
    r: string;
    s: string;
  };
};
export function verifyEvmSignedTxMatched({
  signerAddress,
  rawTx,
  txid,
  signature,
}: IVerifyEvmSignedTxMatchedParams) {
  const txidFromRawTx = ethers.utils.keccak256(rawTx);
  if (txid !== txidFromRawTx || !txid || !txidFromRawTx) {
    throw new Error(`EVM txid not match: ${txid}, ${txidFromRawTx}`);
  }

  const ethersTx = ethers.utils.parseTransaction(rawTx);

  const ethersTxClone = { ...ethersTx };
  // remove invalid field for serializeTransaction()
  //        ERROR: invalid object key - v (argument=\"transaction:v\", value=
  delete ethersTxClone.r;
  delete ethersTxClone.s;
  delete ethersTxClone.v;
  delete ethersTxClone.from;
  delete ethersTxClone.hash;
  const serializeTx = ethers.utils.serializeTransaction(ethersTxClone);

  const { r, s, v } = signature;
  const sig = {
    r,
    s,
    v: Number(v),
  };
  const txHash = ethers.utils.keccak256(serializeTx);

  let recoveredAddress = ethers.utils.recoverAddress(txHash, sig);
  recoveredAddress = recoveredAddress.toLowerCase();
  const address = signerAddress.toLowerCase();

  if (address !== recoveredAddress || !address || !recoveredAddress) {
    throw new Error(
      `EVM Signer address not match: ${address}, ${recoveredAddress}`,
    );
  }
}
