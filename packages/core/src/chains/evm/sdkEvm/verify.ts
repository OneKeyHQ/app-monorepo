import { ethers } from './ethers';

export function verifyEvmSignedTxMatched({
  signerAddress,
  rawTx,
  txid,
  signature,
}: {
  signerAddress: string;
  rawTx: string;
  txid: string;
  signature: {
    v: string | number;
    r: string;
    s: string;
  };
}) {
  const ethersTx = ethers.utils.parseTransaction(rawTx);
  const txHash = ethers.utils.keccak256(
    ethers.utils.serializeTransaction(ethersTx),
  );
  if (txid !== ethers.utils.keccak256(rawTx)) {
    throw new Error('EVM txid not match');
  }
  const { r, s, v } = signature;
  let recoveredAddress = ethers.utils.recoverAddress(txHash, {
    r,
    s,
    v: Number(v),
  });
  recoveredAddress = recoveredAddress.toLowerCase();
  const address = signerAddress.toLowerCase();
  if (address !== recoveredAddress) {
    throw new Error('EVM Signer address not match');
  }
}
