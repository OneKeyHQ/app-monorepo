import * as ethUtils from 'ethereumjs-util';

import { ethers } from './ethers';

export function autoFixPersonalSignMessage({ message }: { message: string }) {
  let messageFixed = message;
  try {
    ethUtils.toBuffer(message);
  } catch (error) {
    const tmpMsg = `0x${message}`;
    try {
      ethUtils.toBuffer(tmpMsg);
      messageFixed = tmpMsg;
    } catch (err) {
      // message not including valid hex character
    }
  }
  return messageFixed;
}

export function verifyPersonalSignMessage({
  message,
  address,
  signature,
}: {
  message: string;
  address: string;
  signature: string;
}) {
  try {
    const messageHash = ethers.utils.hashMessage(message);
    const sig = ethers.utils.splitSignature(signature);
    const recoveredAddress = ethers.utils.recoverAddress(messageHash, {
      r: sig.r,
      s: sig.s,
      v: sig.v,
    });
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.log('verifyPersonalSignMessage error', error);
    return false;
  }
}
